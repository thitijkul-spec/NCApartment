import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { formatDateBE } from "@/lib/date-utils";
import ReportShell from "../ReportShell";

export default async function TenantsReportPage({ searchParams }: { searchParams: { includeInactive?: string } }) {
  const { building } = await requireAccess("report");
  const includeInactive = searchParams.includeInactive === "1";

  const occupancies = await prisma.roomOccupancy.findMany({
    where: {
      room: { buildingId: building.id },
      status: includeInactive ? undefined : "active",
    },
    include: { tenant: true, room: true },
    orderBy: { checkinDate: "desc" },
  });

  const rows = occupancies.map((o) => [
    o.tenant.name,
    o.room.roomNumber,
    o.tenant.phone ?? "-",
    o.tenant.lineUserId ?? "-",
    o.status === "active" ? "อยู่จริง" : "ย้ายออกแล้ว",
    formatDateBE(o.checkinDate),
    o.movedOutDate ? formatDateBE(o.movedOutDate) : "-",
  ]);

  return (
    <ReportShell
      title="รายชื่อผู้เช่าทั้งหมด"
      subtitle={building.name}
      filenamePrefix="tenants"
      excelHeaders={["ชื่อผู้เช่า", "ห้อง", "เบอร์โทร", "LINE ID", "สถานะ", "วันที่เข้าพัก", "วันที่ย้ายออก"]}
      excelRows={rows}
      filterBar={
        <a href={includeInactive ? "/reports/tenants" : "/reports/tenants?includeInactive=1"} className="secondary btn">
          {includeInactive ? "แสดงเฉพาะผู้เช่าปัจจุบัน" : "รวมผู้เช่าที่ย้ายออกแล้ว"}
        </a>
      }
    >
      <table>
        <thead>
          <tr>
            <th>ชื่อผู้เช่า</th>
            <th>ห้อง</th>
            <th>เบอร์โทร</th>
            <th>LINE ID</th>
            <th>สถานะ</th>
            <th>วันที่เข้าพัก</th>
            <th>วันที่ย้ายออก</th>
          </tr>
        </thead>
        <tbody>
          {occupancies.map((o) => (
            <tr key={o.id}>
              <td>{o.tenant.name}</td>
              <td>{o.room.roomNumber}</td>
              <td>{o.tenant.phone ?? "-"}</td>
              <td>{o.tenant.lineUserId ?? "-"}</td>
              <td>{o.status === "active" ? "อยู่จริง" : "ย้ายออกแล้ว"}</td>
              <td>{formatDateBE(o.checkinDate)}</td>
              <td>{o.movedOutDate ? formatDateBE(o.movedOutDate) : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {occupancies.length === 0 && <p className="empty">ไม่มีข้อมูล</p>}
    </ReportShell>
  );
}
