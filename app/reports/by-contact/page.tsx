import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import ReportShell from "../ReportShell";

export default async function ByContactReportPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  const { building } = await requireAccess("report");
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10);
  const defaultTo = now.toISOString().slice(0, 10);
  const from = searchParams.from || defaultFrom;
  const to = searchParams.to || defaultTo;
  const fromDate = new Date(from);
  const toDate = new Date(to + "T23:59:59");

  const [expenses, otherIncomes] = await Promise.all([
    prisma.expense.findMany({ where: { buildingId: building.id, date: { gte: fromDate, lte: toDate }, vendorContactId: { not: null } }, include: { vendorContact: true } }),
    prisma.otherIncome.findMany({ where: { buildingId: building.id, date: { gte: fromDate, lte: toDate }, buyerType: "contact", buyerContactId: { not: null } }, include: { buyerContact: true } }),
  ]);

  const map = new Map<number, { name: string; buyCount: number; buyTotal: number; sellCount: number; sellTotal: number }>();
  for (const e of expenses) {
    if (!e.vendorContactId || !e.vendorContact) continue;
    const entry = map.get(e.vendorContactId) ?? { name: e.vendorContact.name, buyCount: 0, buyTotal: 0, sellCount: 0, sellTotal: 0 };
    entry.buyCount++;
    entry.buyTotal += e.totalAmount;
    map.set(e.vendorContactId, entry);
  }
  for (const inc of otherIncomes) {
    if (!inc.buyerContactId || !inc.buyerContact) continue;
    const entry = map.get(inc.buyerContactId) ?? { name: inc.buyerContact.name, buyCount: 0, buyTotal: 0, sellCount: 0, sellTotal: 0 };
    entry.sellCount++;
    entry.sellTotal += inc.totalAmount;
    map.set(inc.buyerContactId, entry);
  }

  const rows = Array.from(map.values()).sort((a, b) => b.buyTotal + b.sellTotal - (a.buyTotal + a.sellTotal));

  return (
    <ReportShell
      title="ยอดซื้อ-ขายตามคู่ค้า"
      subtitle={building.name}
      filenamePrefix="by-contact"
      excelHeaders={["ชื่อคู่ค้า", "จำนวนรายการซื้อ", "ยอดซื้อรวม", "จำนวนรายการขาย", "ยอดขายรวม"]}
      excelRows={rows.map((r) => [r.name, r.buyCount, r.buyTotal, r.sellCount, r.sellTotal])}
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
            <th>ชื่อคู่ค้า</th>
            <th>จำนวนรายการซื้อ</th>
            <th>ยอดซื้อรวม</th>
            <th>จำนวนรายการขาย</th>
            <th>ยอดขายรวม</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.name}</td>
              <td>{r.buyCount}</td>
              <td>฿{r.buyTotal.toLocaleString()}</td>
              <td>{r.sellCount}</td>
              <td>฿{r.sellTotal.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="empty">ไม่มีข้อมูล</p>}
    </ReportShell>
  );
}
