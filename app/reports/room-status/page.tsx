import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { formatDateBE } from "@/lib/date-utils";
import { ROOM_STATUS_LABEL } from "@/lib/room-utils";
import ReportShell from "../ReportShell";

export default async function RoomStatusReportPage() {
  const { building } = await requireAccess("report");

  const rooms = await prisma.room.findMany({
    where: { buildingId: building.id },
    include: {
      occupancies: { where: { status: "active" }, include: { tenant: true } },
      contracts: { where: { archivedAt: null, signedAt: { not: null } }, orderBy: { startDate: "desc" }, take: 1 },
      bookings: { where: { status: { in: ["pending", "confirmed"] } }, take: 1 },
    },
    orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
  });

  const occ = rooms.filter((r) => r.occupancies.length > 0);
  const monthlyCount = occ.filter((r) => r.occupancies[0].tenant.tenantType === "monthly").length;
  const dailyCount = occ.filter((r) => r.occupancies[0].tenant.tenantType === "daily").length;
  const availableCount = rooms.filter((r) => r.status === "available").length;
  const reservedCount = rooms.filter((r) => r.status === "reserved").length;
  const maintenanceCount = rooms.filter((r) => r.status === "maintenance").length;

  const rows = rooms.map((r) => {
    const activeOcc = r.occupancies[0];
    const contract = r.contracts[0];
    const booking = r.bookings[0];
    return [
      r.roomNumber,
      r.floor,
      r.rentalTypeSupport,
      ROOM_STATUS_LABEL[r.status] ?? r.status,
      activeOcc ? (activeOcc.tenant.tenantType === "monthly" ? "รายเดือน" : "รายวัน") : "-",
      activeOcc?.tenant.name ?? "-",
      activeOcc?.tenant.phone ?? "-",
      activeOcc ? formatDateBE(activeOcc.checkinDate) : "-",
      contract && !contract.noEndDate && contract.endDate ? formatDateBE(contract.endDate) : booking ? formatDateBE(booking.checkinDate) : "-",
    ];
  });

  return (
    <ReportShell
      title="สรุปสถานะห้องพัก/ผู้เช่า"
      subtitle={building.name}
      filenamePrefix="room-status"
      excelHeaders={["เลขห้อง", "ชั้น", "รองรับ", "สถานะ", "ประเภทเช่าปัจจุบัน", "ผู้เช่า", "เบอร์โทร", "วันที่เข้าพัก", "วันสิ้นสุด/วันจอง"]}
      excelRows={rows}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginBottom: 16 }} className="no-print">
        {[
          ["ห้องทั้งหมด", rooms.length],
          ["รายเดือน", monthlyCount],
          ["รายวัน", dailyCount],
          ["ว่าง", availableCount],
          ["จองแล้ว", reservedCount],
          ["ปิดปรับปรุง", maintenanceCount],
        ].map(([label, val]) => (
          <div className="card" key={label as string}>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{label}</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{val}</div>
          </div>
        ))}
      </div>
      <table>
        <thead>
          <tr>
            <th>เลขห้อง</th>
            <th>ชั้น</th>
            <th>รองรับ</th>
            <th>สถานะ</th>
            <th>ประเภทเช่าปัจจุบัน</th>
            <th>ผู้เช่า</th>
            <th>เบอร์โทร</th>
            <th>วันที่เข้าพัก</th>
            <th>วันสิ้นสุด/วันจอง</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ReportShell>
  );
}
