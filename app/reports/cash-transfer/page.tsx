import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { formatDateBE } from "@/lib/date-utils";
import ReportShell from "../ReportShell";

function dayKey(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default async function CashTransferReportPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { building } = await requireAccess("report");
  const today = new Date().toISOString().slice(0, 10);
  const from = searchParams.from || today;
  const to = searchParams.to || today;
  const fromDate = new Date(from + "T00:00:00");
  const toDate = new Date(to + "T23:59:59");

  const [payments, otherIncomePayments] = await Promise.all([
    prisma.payment.findMany({
      where: { bill: { buildingId: building.id }, paidAt: { gte: fromDate, lte: toDate }, method: { in: ["cash", "transfer"] } },
      select: { amount: true, method: true, paidAt: true },
    }),
    prisma.otherIncomePayment.findMany({
      where: { otherIncome: { buildingId: building.id }, date: { gte: fromDate, lte: toDate }, method: { in: ["cash", "transfer"] } },
      select: { amount: true, method: true, date: true },
    }),
  ]);

  const byDay = new Map<string, { cash: number; transfer: number }>();
  for (const p of payments) {
    const k = dayKey(new Date(p.paidAt));
    const entry = byDay.get(k) ?? { cash: 0, transfer: 0 };
    if (p.method === "cash") entry.cash += p.amount;
    else entry.transfer += p.amount;
    byDay.set(k, entry);
  }
  for (const p of otherIncomePayments) {
    const k = dayKey(new Date(p.date));
    const entry = byDay.get(k) ?? { cash: 0, transfer: 0 };
    if (p.method === "cash") entry.cash += p.amount;
    else entry.transfer += p.amount;
    byDay.set(k, entry);
  }

  const rows = Array.from(byDay.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, v]) => ({ day, ...v, total: v.cash + v.transfer }));
  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  return (
    <ReportShell
      title="สรุปเงินสด-โอน"
      subtitle={building.name}
      filenamePrefix="cash-transfer"
      excelHeaders={["วันที่", "ยอดรับเงินสด", "ยอดรับโอน", "รวมทั้งวัน"]}
      excelRows={rows.map((r) => [formatDateBE(r.day), r.cash, r.transfer, r.total])}
      filterBar={
        <form method="get" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="date" name="from" defaultValue={from} />
          <span>ถึง</span>
          <input type="date" name="to" defaultValue={to} />
          <button type="submit" className="secondary">
            ดูรายงาน
          </button>
        </form>
      }
    >
      <table>
        <thead>
          <tr>
            <th>วันที่</th>
            <th>ยอดรับเงินสด</th>
            <th>ยอดรับโอน</th>
            <th>รวมทั้งวัน</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.day}>
              <td>{formatDateBE(r.day)}</td>
              <td>฿{r.cash.toLocaleString()}</td>
              <td>฿{r.transfer.toLocaleString()}</td>
              <td>฿{r.total.toLocaleString()}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={3}>
              <strong>รวมทั้งหมด</strong>
            </td>
            <td>
              <strong>฿{grandTotal.toLocaleString()}</strong>
            </td>
          </tr>
        </tbody>
      </table>
      {rows.length === 0 && <p className="empty">ไม่มีข้อมูล</p>}
    </ReportShell>
  );
}
