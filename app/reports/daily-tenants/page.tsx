import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { formatDateBE } from "@/lib/date-utils";
import ReportShell from "../ReportShell";

function fmtTime(d: Date | string) {
  return new Date(d).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

export default async function DailyTenantsReportPage({ searchParams }: { searchParams: { date?: string } }) {
  const { building } = await requireAccess("report");
  const date = searchParams.date || new Date().toISOString().slice(0, 10);
  const dayStart = new Date(date + "T00:00:00");
  const dayEnd = new Date(date + "T23:59:59.999");

  const dailyBills = await prisma.dailyBill.findMany({
    where: { buildingId: building.id, createdAt: { gte: dayStart, lte: dayEnd } },
    include: { room: true, tenant: true },
    orderBy: { createdAt: "asc" },
  });

  const now = new Date();
  const rows = dailyBills.map((b) => {
    const checkoutDate = new Date(new Date(b.checkinDate).getTime() + b.nights * 24 * 60 * 60 * 1000);
    return {
      id: b.id,
      roomNumber: b.room.roomNumber,
      tenantName: b.tenant.name,
      phone: b.tenant.phone ?? "-",
      status: now <= checkoutDate ? "พักอยู่" : "ออกแล้ว",
      nights: b.nights,
      checkinDate: b.checkinDate,
      checkoutDate,
      cash: b.method === "cash" ? b.totalAmount : 0,
      transfer: b.method === "transfer" ? b.totalAmount : 0,
      transferTime: b.transferTime ?? "-",
      recordedAt: fmtTime(b.createdAt),
    };
  });

  const totalCash = rows.reduce((s, r) => s + r.cash, 0);
  const totalTransfer = rows.reduce((s, r) => s + r.transfer, 0);

  return (
    <ReportShell
      title="รายงานลูกค้ารายวัน"
      subtitle={building.name}
      filenamePrefix="daily-tenants"
      excelHeaders={[
        "รายวัน/รายเดือน",
        "ห้อง",
        "ลูกค้า",
        "เบอร์โทร",
        "สถานะ",
        "จำนวนวันพัก",
        "วันที่เริ่มต้น",
        "วันที่สิ้นสุด",
        "เงินสด",
        "โอนพร้อมเพย์",
        "เวลาโอน",
        "เริ่มเช่า",
      ]}
      excelRows={rows.map((r) => [
        "รายวัน",
        r.roomNumber,
        r.tenantName,
        r.phone,
        r.status,
        r.nights,
        formatDateBE(r.checkinDate),
        formatDateBE(r.checkoutDate),
        r.cash,
        r.transfer,
        r.transferTime,
        r.recordedAt,
      ])}
      filterBar={
        <form method="get" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label style={{ fontSize: 13, color: "var(--text-muted)" }}>วันที่</label>
          <input type="date" name="date" defaultValue={date} />
          <button type="submit" className="secondary">
            ดูรายงาน
          </button>
        </form>
      }
    >
      <div className="stat-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="label">เงินสดวันนี้</div>
          <div className="value">฿{totalCash.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="label">โอน/พร้อมเพย์วันนี้</div>
          <div className="value">฿{totalTransfer.toLocaleString()}</div>
        </div>
        <div className="stat-card">
          <div className="label">รวมทั้งหมด</div>
          <div className="value">฿{(totalCash + totalTransfer).toLocaleString()}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>รายวัน/รายเดือน</th>
            <th>เตียง</th>
            <th>ลูกค้า</th>
            <th>เบอร์โทร</th>
            <th>สถานะ</th>
            <th>จำนวนวันพัก</th>
            <th>วันที่เริ่มต้น</th>
            <th>วันที่สิ้นสุด</th>
            <th>เงินสด</th>
            <th>โอนพร้อมเพย์</th>
            <th>เวลาโอน</th>
            <th>เริ่มเช่า</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td>รายวัน</td>
              <td>{r.roomNumber}</td>
              <td>{r.tenantName}</td>
              <td>{r.phone}</td>
              <td>
                <span className={`badge ${r.status === "พักอยู่" ? "success" : "neutral"}`}>{r.status}</span>
              </td>
              <td>{r.nights}</td>
              <td>{formatDateBE(r.checkinDate)}</td>
              <td>{formatDateBE(r.checkoutDate)}</td>
              <td>{r.cash > 0 ? `฿${r.cash.toLocaleString()}` : "-"}</td>
              <td>{r.transfer > 0 ? `฿${r.transfer.toLocaleString()}` : "-"}</td>
              <td>{r.transferTime}</td>
              <td>{r.recordedAt}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="empty">ไม่มีข้อมูลลูกค้ารายวันของวันที่เลือก</p>}
    </ReportShell>
  );
}
