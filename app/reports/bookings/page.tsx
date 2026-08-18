import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { formatDateBE } from "@/lib/date-utils";
import ReportShell from "../ReportShell";

const STATUS_LABEL: Record<string, string> = { pending: "รอยืนยัน", confirmed: "ยืนยันแล้ว", cancelled: "ยกเลิก", completed: "เสร็จสิ้น", archived: "เก็บแล้ว" };

export default async function BookingsReportPage({ searchParams }: { searchParams: { status?: string } }) {
  const { building } = await requireAccess("report");
  const statusFilter = searchParams.status;

  const bookings = await prisma.booking.findMany({
    where: { buildingId: building.id, status: statusFilter || undefined },
    include: { room: true, tenant: true },
    orderBy: { checkinDate: "desc" },
  });

  return (
    <ReportShell
      title="รายงานการจอง"
      subtitle={building.name}
      filenamePrefix="bookings"
      excelHeaders={["ห้อง", "ผู้จอง", "วันเข้าพัก", "วันออก", "จำนวนคืน", "สถานะ", "เหตุผลยกเลิก"]}
      excelRows={bookings.map((b) => [
        b.room?.roomNumber ?? "ยังไม่เลือกห้อง",
        b.tenant?.name ?? "-",
        formatDateBE(b.checkinDate),
        b.checkoutDate ? formatDateBE(b.checkoutDate) : "-",
        b.nights ?? "-",
        STATUS_LABEL[b.status] ?? b.status,
        b.cancelReason ?? "-",
      ])}
      filterBar={
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <a href="/reports/bookings" className={`secondary btn${!statusFilter ? " active" : ""}`}>
            ทั้งหมด
          </a>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <a key={k} href={`/reports/bookings?status=${k}`} className={`secondary btn${statusFilter === k ? " active" : ""}`}>
              {v}
            </a>
          ))}
        </div>
      }
    >
      <table>
        <thead>
          <tr>
            <th>ห้อง</th>
            <th>ผู้จอง</th>
            <th>วันเข้าพัก</th>
            <th>วันออก</th>
            <th>จำนวนคืน</th>
            <th>สถานะ</th>
            <th>เหตุผลยกเลิก</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.id}>
              <td>{b.room?.roomNumber ?? "ยังไม่เลือกห้อง"}</td>
              <td>{b.tenant?.name ?? "-"}</td>
              <td>{formatDateBE(b.checkinDate)}</td>
              <td>{b.checkoutDate ? formatDateBE(b.checkoutDate) : "-"}</td>
              <td>{b.nights ?? "-"}</td>
              <td>{STATUS_LABEL[b.status] ?? b.status}</td>
              <td>{b.cancelReason ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {bookings.length === 0 && <p className="empty">ไม่มีข้อมูล</p>}
    </ReportShell>
  );
}
