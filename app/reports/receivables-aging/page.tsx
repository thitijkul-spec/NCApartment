import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { getReceivablesSummary } from "@/lib/accounting-queries";
import { formatDateBE } from "@/lib/date-utils";
import ReportShell from "../ReportShell";

export default async function ReceivablesAgingReportPage({ searchParams }: { searchParams: { view?: string; sort?: string } }) {
  const { building } = await requireAccess("report");
  const view = searchParams.view === "detail" ? "detail" : "summary";
  const sort = searchParams.sort === "room" ? "room" : "days";

  if (view === "summary") {
    const summary = await getReceivablesSummary(building.id);
    const total = summary.reduce((s, r) => s + r.balance, 0);

    return (
      <ReportShell
        title="สรุปห้องค้างชำระ"
        subtitle={`${building.name} · แบบสรุปตามห้อง`}
        filenamePrefix="receivables-aging-summary"
        excelHeaders={["ผู้เช่า", "ห้อง", "จำนวนบิลค้าง", "ยอดรวมค้าง"]}
        excelRows={summary.map((r) => [r.tenantName, r.rooms, r.billCount, r.balance])}
        filterBar={<ViewToggle view={view} sort={sort} />}
      >
        <table>
          <thead>
            <tr>
              <th>ผู้เช่า</th>
              <th>ห้อง</th>
              <th>จำนวนบิลค้าง</th>
              <th>ยอดรวมค้าง</th>
            </tr>
          </thead>
          <tbody>
            {summary.map((r) => (
              <tr key={r.tenantId}>
                <td>{r.tenantName}</td>
                <td>{r.rooms}</td>
                <td>{r.billCount}</td>
                <td>฿{r.balance.toLocaleString()}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={3}>
                <strong>ยอดรวมค้างชำระทั้งหมด</strong>
              </td>
              <td>
                <strong>฿{total.toLocaleString()}</strong>
              </td>
            </tr>
          </tbody>
        </table>
        {summary.length === 0 && <p className="empty">ไม่มีค้างชำระ</p>}
      </ReportShell>
    );
  }

  const bills = await prisma.bill.findMany({
    where: { buildingId: building.id, status: { in: ["unpaid", "partially_paid"] } },
    include: { room: true, tenant: true, lineItems: true, payments: true },
  });

  const rows = bills
    .map((b) => {
      const total = b.lineItems.reduce((s, li) => s + li.amount, 0) - (b.discountAmount ?? 0);
      const paid = b.payments.reduce((s, p) => s + p.amount, 0);
      const balance = total - paid;
      const daysOverdue = Math.max(0, Math.floor((Date.now() - new Date(b.dueDate).getTime()) / (1000 * 60 * 60 * 24)));
      return { bill: b, balance, daysOverdue };
    })
    .filter((r) => r.balance > 0)
    .sort((a, b) => (sort === "room" ? a.bill.room.roomNumber.localeCompare(b.bill.room.roomNumber) : b.daysOverdue - a.daysOverdue));

  const total = rows.reduce((s, r) => s + r.balance, 0);

  return (
    <ReportShell
      title="สรุปห้องค้างชำระ"
      subtitle={`${building.name} · แบบรายการละเอียด`}
      filenamePrefix="receivables-aging-detail"
      excelHeaders={["ห้อง", "ผู้เช่า", "เดือนบิล", "ยอดค้าง", "ค้างมา (วัน)"]}
      excelRows={rows.map((r) => [r.bill.room.roomNumber, r.bill.tenant.name, r.bill.billingMonth, r.balance, r.daysOverdue])}
      filterBar={<ViewToggle view={view} sort={sort} />}
    >
      <table>
        <thead>
          <tr>
            <th>ห้อง</th>
            <th>ผู้เช่า</th>
            <th>เดือนบิล</th>
            <th>ยอดค้าง</th>
            <th>ค้างมา (วัน)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.bill.id}>
              <td>{r.bill.room.roomNumber}</td>
              <td>{r.bill.tenant.name}</td>
              <td>{r.bill.billingMonth}</td>
              <td>฿{r.balance.toLocaleString()}</td>
              <td>{r.daysOverdue}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={3}>
              <strong>ยอดรวมค้างชำระทั้งหมด</strong>
            </td>
            <td colSpan={2}>
              <strong>฿{total.toLocaleString()}</strong>
            </td>
          </tr>
        </tbody>
      </table>
      {rows.length === 0 && <p className="empty">ไม่มีค้างชำระ</p>}
    </ReportShell>
  );
}

function ViewToggle({ view, sort }: { view: string; sort: string }) {
  return (
    <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ display: "flex", gap: 8 }}>
        <a href="/reports/receivables-aging?view=summary" className={`secondary btn${view === "summary" ? " active" : ""}`}>
          แบบสรุปตามห้อง
        </a>
        <a href="/reports/receivables-aging?view=detail" className={`secondary btn${view === "detail" ? " active" : ""}`}>
          แบบรายการละเอียด
        </a>
      </div>
      {view === "detail" && (
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/reports/receivables-aging?view=detail&sort=days" className={`secondary btn${sort === "days" ? " active" : ""}`}>
            ค้างนานสุดก่อน
          </a>
          <a href="/reports/receivables-aging?view=detail&sort=room" className={`secondary btn${sort === "room" ? " active" : ""}`}>
            เรียงตามห้อง
          </a>
        </div>
      )}
    </div>
  );
}
