import { prisma } from "@/lib/prisma";
import { getDefaultBranch } from "../rooms/actions";
import { createBooking, setBookingStatus } from "./actions";
import { getCurrentUser, hasModuleAccess } from "@/lib/auth";
import { redirect } from "next/navigation";

const statusLabel: Record<string, string> = {
  booked: "จองแล้ว",
  checked_in: "เช็คอินแล้ว",
  checked_out: "เช็คเอาท์แล้ว",
  cancelled: "ยกเลิก",
  no_show: "ไม่มาพัก",
};

const nextActions: Record<string, { status: string; label: string }[]> = {
  booked: [
    { status: "checked_in", label: "เช็คอิน" },
    { status: "cancelled", label: "ยกเลิก" },
    { status: "no_show", label: "ไม่มาพัก" },
  ],
  checked_in: [{ status: "checked_out", label: "เช็คเอาท์" }],
  checked_out: [],
  cancelled: [],
  no_show: [],
};

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

export default async function BookingsPage({
  searchParams,
}: {
  searchParams: { roomId?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasModuleAccess(user, "A")) {
    return <div className="card">ไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
  }

  const preselectedRoomId = searchParams.roomId ? Number(searchParams.roomId) : undefined;
  const branch = await getDefaultBranch();
  const rooms = await prisma.room.findMany({
    where: { branchId: branch.id },
    include: { roomType: true },
    orderBy: { roomNumber: "asc" },
  });
  const customers = await prisma.customer.findMany({ orderBy: { name: "asc" } });
  const blacklist = await prisma.blacklist.findMany({ where: { active: true } });
  const blacklistedPhones = new Set(blacklist.map((b) => b.phone));
  const bookings = await prisma.booking.findMany({
    include: { room: true, customer: true },
    orderBy: { id: "desc" },
  });

  return (
    <div>
      <h1 className="page-title">การจองรายวัน</h1>

      <div className="card">
        <h2>รายการจอง</h2>
        {bookings.length === 0 ? (
          <p className="empty">ยังไม่มีการจอง</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ห้อง</th>
                <th>ลูกค้า</th>
                <th>เช็คอิน</th>
                <th>เช็คเอาท์</th>
                <th>คืน</th>
                <th>ยอดรวม</th>
                <th>มัดจำ</th>
                <th>สถานะ</th>
                <th>ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => (
                <tr key={b.id}>
                  <td>{b.room.roomNumber}</td>
                  <td>
                    {b.customer.name}
                    <br />
                    <span style={{ color: "var(--muted)", fontSize: 13 }}>{b.customer.phone}</span>
                  </td>
                  <td>{formatDate(b.checkinDate)}</td>
                  <td>{formatDate(b.checkoutDate)}</td>
                  <td>{b.nights}</td>
                  <td>{b.totalAmount.toLocaleString()}</td>
                  <td>{b.depositPaid.toLocaleString()}</td>
                  <td>
                    <span className="badge available">{statusLabel[b.status] ?? b.status}</span>
                  </td>
                  <td>
                    <div className="status-buttons">
                      {(nextActions[b.status] ?? []).map((a) => (
                        <form key={a.status} action={setBookingStatus.bind(null, b.id, a.status)}>
                          <button type="submit" className="secondary">
                            {a.label}
                          </button>
                        </form>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form action={createBooking} className="form-row" style={{ marginTop: 16 }}>
          <div className="field">
            <label>ห้อง</label>
            <select name="roomId" required disabled={rooms.length === 0} defaultValue={preselectedRoomId ?? ""}>
              <option value="">เลือกห้อง</option>
              {rooms.map((r) => {
                const effDaily = r.priceDaily ?? r.roomType.priceDaily;
                return (
                  <option key={r.id} value={r.id}>
                    {r.roomNumber} — {r.roomType.name}
                    {effDaily ? ` (${effDaily}/คืน)` : ""}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="field">
            <label>ลูกค้า</label>
            <select name="customerId" required disabled={customers.length === 0}>
              <option value="">เลือกลูกค้า</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {blacklistedPhones.has(c.phone) ? "⚠️ " : ""}
                  {c.name} ({c.phone})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>วันเช็คอิน</label>
            <input name="checkinDate" type="date" required />
          </div>
          <div className="field">
            <label>วันเช็คเอาท์</label>
            <input name="checkoutDate" type="date" required />
          </div>
          <div className="field">
            <label>ราคา/คืน (บาท)</label>
            <input
              name="pricePerNight"
              type="number"
              step="0.01"
              required
              defaultValue={
                preselectedRoomId
                  ? rooms.find((r) => r.id === preselectedRoomId)?.priceDaily ??
                    rooms.find((r) => r.id === preselectedRoomId)?.roomType.priceDaily ??
                    undefined
                  : undefined
              }
            />
          </div>
          <div className="field">
            <label>ส่วนลด (บาท)</label>
            <input name="discountAmount" type="number" step="0.01" defaultValue={0} />
          </div>
          <div className="field">
            <label>เหตุผลส่วนลด</label>
            <input name="discountReason" />
          </div>
          <div className="field">
            <label>เงินมัดจำที่รับแล้ว</label>
            <input name="depositPaid" type="number" step="0.01" defaultValue={0} />
          </div>
          <div className="field">
            <label>ประเภทการจอง</label>
            <select name="bookingType">
              <option value="walkin">Walk-in</option>
              <option value="advance">จองล่วงหน้า</option>
            </select>
          </div>
          <div className="field">
            <label>การชำระเงิน</label>
            <select name="paymentTiming">
              <option value="pay_before_checkin">จ่ายก่อนเข้าพัก</option>
              <option value="prepaid_full">จ่ายเต็มล่วงหน้า</option>
              <option value="pay_after_checkout">จ่ายหลังเช็คเอาท์</option>
            </select>
          </div>
          <button type="submit" disabled={rooms.length === 0 || customers.length === 0}>
            เพิ่มการจอง
          </button>
        </form>
        {(rooms.length === 0 || customers.length === 0) && (
          <p className="empty">ต้องมีอย่างน้อย 1 ห้อง และ 1 ลูกค้า ก่อนสร้างการจอง</p>
        )}
      </div>
    </div>
  );
}
