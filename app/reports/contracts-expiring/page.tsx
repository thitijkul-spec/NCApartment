import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { formatDateBE } from "@/lib/date-utils";
import ReportShell from "../ReportShell";

export default async function ContractsExpiringReportPage({ searchParams }: { searchParams: { days?: string } }) {
  const { building } = await requireAccess("report");
  const days = Number(searchParams.days) || 60;
  const now = new Date();

  const contracts = await prisma.contract.findMany({
    where: { buildingId: building.id, archivedAt: null, signedAt: { not: null }, noEndDate: false, endDate: { not: null } },
    include: { room: true, tenant: true },
  });

  const rows = contracts
    .map((c) => ({ ...c, daysLeft: Math.ceil((new Date(c.endDate!).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) }))
    .filter((c) => c.daysLeft <= days)
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return (
    <ReportShell
      title="สัญญาใกล้หมดอายุ"
      subtitle={building.name}
      filenamePrefix="contracts-expiring"
      excelHeaders={["ห้อง", "ชื่อผู้เช่า", "เบอร์โทร", "วันเริ่มสัญญา", "วันหมดสัญญา", "เหลืออีก (วัน)"]}
      excelRows={rows.map((c) => [c.room.roomNumber, c.tenant.name, c.tenant.phone ?? "-", formatDateBE(c.startDate), formatDateBE(c.endDate!), c.daysLeft])}
      filterBar={
        <div style={{ display: "flex", gap: 8 }}>
          {[30, 60, 90].map((d) => (
            <a key={d} href={`/reports/contracts-expiring?days=${d}`} className={`secondary btn${days === d ? " active" : ""}`}>
              ≤ {d} วัน
            </a>
          ))}
        </div>
      }
    >
      <table>
        <thead>
          <tr>
            <th>ห้อง</th>
            <th>ชื่อผู้เช่า</th>
            <th>เบอร์โทร</th>
            <th>วันเริ่มสัญญา</th>
            <th>วันหมดสัญญา</th>
            <th>เหลืออีก (วัน)</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id}>
              <td>{c.room.roomNumber}</td>
              <td>{c.tenant.name}</td>
              <td>{c.tenant.phone ?? "-"}</td>
              <td>{formatDateBE(c.startDate)}</td>
              <td>{formatDateBE(c.endDate!)}</td>
              <td>{c.daysLeft}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="empty">ไม่มีสัญญาใกล้หมดอายุ</p>}
    </ReportShell>
  );
}
