import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { EXPENSE_CATEGORIES } from "@/app/expenses/types";
import { OTHER_INCOME_CATEGORIES } from "@/app/other-income/types";
import { expensePaymentStatus } from "@/app/expenses/types";
import { otherIncomePaymentStatus } from "@/app/other-income/types";
import ReportShell from "../ReportShell";

function monthRange(fromStr?: string, toStr?: string) {
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const from = fromStr ? new Date(fromStr + "-01") : defaultFrom;
  const to = toStr ? new Date(toStr + "-01") : new Date(now.getFullYear(), now.getMonth(), 1);
  const months: { year: number; month: number; label: string; key: string }[] = [];
  const cur = new Date(from);
  while (cur <= to) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth(), label: `${cur.getMonth() + 1}/${cur.getFullYear() + 543}`, key: `${cur.getFullYear()}-${cur.getMonth()}` });
    cur.setMonth(cur.getMonth() + 1);
  }
  return { months, from, to: new Date(to.getFullYear(), to.getMonth() + 1, 0) };
}

export default async function RevenueExpenseReportPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { building } = await requireAccess("report");
  const { months, from, to } = monthRange(searchParams.from, searchParams.to);

  const [payments, otherIncomes, expenses] = await Promise.all([
    prisma.payment.findMany({ where: { bill: { buildingId: building.id }, paidAt: { gte: from, lte: to } }, select: { amount: true, paidAt: true } }),
    prisma.otherIncome.findMany({ where: { buildingId: building.id, date: { gte: from, lte: to } }, include: { lineItems: true, payments: true } }),
    prisma.expense.findMany({ where: { buildingId: building.id, date: { gte: from, lte: to } }, include: { lineItems: true, payments: true } }),
  ]);

  const paidOtherIncomes = otherIncomes.filter((o) => otherIncomePaymentStatus(o) === "paid");
  const paidExpenses = expenses.filter((e) => expensePaymentStatus(e) === "paid");

  function monthKey(d: Date) {
    return `${d.getFullYear()}-${d.getMonth()}`;
  }

  const rentByMonth = new Map<string, number>();
  for (const p of payments) rentByMonth.set(monthKey(new Date(p.paidAt)), (rentByMonth.get(monthKey(new Date(p.paidAt))) ?? 0) + p.amount);

  const incomeByCategoryMonth = new Map<string, number>(); // key: category|monthKey
  for (const inc of paidOtherIncomes) {
    const mk = monthKey(new Date(inc.date));
    for (const li of inc.lineItems) {
      const key = `${li.category}|${mk}`;
      incomeByCategoryMonth.set(key, (incomeByCategoryMonth.get(key) ?? 0) + li.totalWithVat);
    }
  }

  const expenseByCategoryMonth = new Map<string, number>();
  for (const exp of paidExpenses) {
    const mk = monthKey(new Date(exp.date));
    for (const li of exp.lineItems) {
      const key = `${li.category}|${mk}`;
      expenseByCategoryMonth.set(key, (expenseByCategoryMonth.get(key) ?? 0) + li.totalWithVat);
    }
  }

  type Row = { label: string; values: number[]; total: number; bold?: boolean };
  const rows: Row[] = [];

  const rentRow: Row = { label: "รายรับ - ค่าเช่า", values: months.map((m) => rentByMonth.get(m.key) ?? 0), total: 0 };
  rentRow.total = rentRow.values.reduce((s, v) => s + v, 0);
  rows.push(rentRow);

  for (const cat of OTHER_INCOME_CATEGORIES) {
    const values = months.map((m) => incomeByCategoryMonth.get(`${cat}|${m.key}`) ?? 0);
    if (values.every((v) => v === 0)) continue;
    rows.push({ label: `รายรับ - ${cat}`, values, total: values.reduce((s, v) => s + v, 0) });
  }

  const revenueRows = rows;
  const totalRevenueRow: Row = {
    label: "รวมรายรับ",
    values: months.map((_, i) => revenueRows.reduce((s, r) => s + r.values[i], 0)),
    total: revenueRows.reduce((s, r) => s + r.total, 0),
    bold: true,
  };
  rows.push(totalRevenueRow);

  const expenseRowsStart = rows.length;
  for (const cat of EXPENSE_CATEGORIES) {
    const values = months.map((m) => expenseByCategoryMonth.get(`${cat}|${m.key}`) ?? 0);
    if (values.every((v) => v === 0)) continue;
    rows.push({ label: `รายจ่าย - ${cat}`, values, total: values.reduce((s, v) => s + v, 0) });
  }
  const expenseRows = rows.slice(expenseRowsStart);
  const totalExpenseRow: Row = {
    label: "รวมรายจ่าย",
    values: months.map((_, i) => expenseRows.reduce((s, r) => s + r.values[i], 0)),
    total: expenseRows.reduce((s, r) => s + r.total, 0),
    bold: true,
  };
  rows.push(totalExpenseRow);

  const netRow: Row = {
    label: "กำไร/ขาดทุนสุทธิ",
    values: months.map((_, i) => totalRevenueRow.values[i] - totalExpenseRow.values[i]),
    total: totalRevenueRow.total - totalExpenseRow.total,
    bold: true,
  };
  rows.push(netRow);

  const fromMonthStr = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, "0")}`;
  const toMonthStr = `${months[months.length - 1]?.year ?? from.getFullYear()}-${String((months[months.length - 1]?.month ?? from.getMonth()) + 1).padStart(2, "0")}`;

  return (
    <ReportShell
      title="สรุปรายรับ-รายจ่าย"
      subtitle={building.name}
      filenamePrefix="revenue-expense"
      excelHeaders={["หมวดหมู่", ...months.map((m) => m.label), "รวม"]}
      excelRows={rows.map((r) => [r.label, ...r.values, r.total])}
      filterBar={
        <form method="get" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="month" name="from" defaultValue={fromMonthStr} />
          <span>ถึง</span>
          <input type="month" name="to" defaultValue={toMonthStr} />
          <button type="submit" className="secondary">
            ดูรายงาน
          </button>
        </form>
      }
    >
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th>หมวดหมู่</th>
              {months.map((m) => (
                <th key={m.key}>{m.label}</th>
              ))}
              <th>รวม</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.bold ? <strong>{r.label}</strong> : r.label}</td>
                {r.values.map((v, j) => (
                  <td key={j}>{r.bold ? <strong>{v.toLocaleString()}</strong> : v.toLocaleString()}</td>
                ))}
                <td>{r.bold ? <strong>{r.total.toLocaleString()}</strong> : r.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ReportShell>
  );
}
