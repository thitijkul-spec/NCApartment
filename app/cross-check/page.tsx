import { prisma } from "@/lib/prisma";
import { getDefaultBranch } from "../rooms/actions";
import PrintButton from "../bills/PrintButton";
import { getCurrentUser, hasModuleAccess } from "@/lib/auth";
import { redirect } from "next/navigation";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday() {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

export default async function CrossCheckPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasModuleAccess(user, "M")) {
    return <div className="card">ไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
  }

  const branch = await getDefaultBranch();
  const today0 = startOfToday();
  const today1 = endOfToday();

  const dailyRooms = await prisma.room.findMany({
    where: { branchId: branch.id, currentMode: "daily" },
  });
  const checkinToday = await prisma.booking.count({
    where: { checkinDate: { gte: today0, lte: today1 }, status: "checked_in" },
  });
  const checkoutToday = await prisma.booking.count({
    where: { checkoutDate: { gte: today0, lte: today1 }, status: "checked_out" },
  });
  const availableDailyRooms = dailyRooms.filter((r) => r.status === "available").length;

  const paymentsToday = await prisma.payment.findMany({
    where: { paymentDate: { gte: today0, lte: today1 } },
  });
  const cashTotal = paymentsToday
    .filter((p) => p.paymentMethod === "cash")
    .reduce((s, p) => s + p.amount, 0);
  const transferTotal = paymentsToday
    .filter((p) => p.paymentMethod !== "cash")
    .reduce((s, p) => s + p.amount, 0);

  const activeBookings = await prisma.booking.findMany({
    where: {
      status: "checked_in",
      room: { branchId: branch.id, currentMode: "daily" },
    },
    include: { room: true, customer: true, bills: { include: { payments: true } } },
    orderBy: { room: { roomNumber: "asc" } },
  });

  return (
    <div>
      <h1 className="page-title">เช็คยอดประจำวัน</h1>

      <div className="card">
        <h2>สรุปวันนี้ — {formatDate(new Date())}</h2>
        <div className="form-row">
          <div className="field">
            <label>ห้องรายวันทั้งหมด</label>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{dailyRooms.length}</div>
          </div>
          <div className="field">
            <label>เช็คอินวันนี้</label>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{checkinToday}</div>
          </div>
          <div className="field">
            <label>เช็คเอาท์วันนี้</label>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{checkoutToday}</div>
          </div>
          <div className="field">
            <label>ห้องว่าง</label>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{availableDailyRooms}</div>
          </div>
          <div className="field">
            <label>เงินสดรับวันนี้</label>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{cashTotal.toLocaleString()}</div>
          </div>
          <div className="field">
            <label>โอนเงินรับวันนี้</label>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{transferTotal.toLocaleString()}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>ห้องที่กำลังพัก (รายวัน)</h2>
        {activeBookings.length === 0 ? (
          <p className="empty">ไม่มีห้องที่กำลังพักตอนนี้</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ห้อง</th>
                <th>ลูกค้า</th>
                <th>เบอร์โทร</th>
                <th>เริ่ม</th>
                <th>สิ้นสุด</th>
                <th>ยอดบิล</th>
                <th>ชำระแล้ว</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {activeBookings.map((b) => {
                const billTotal = b.bills.reduce((s, bill) => s + bill.totalAmount, 0);
                const billPaid = b.bills.reduce(
                  (s, bill) => s + bill.payments.reduce((s2, p) => s2 + p.amount, 0),
                  0
                );
                return (
                  <tr key={b.id}>
                    <td>{b.room.roomNumber}</td>
                    <td>{b.customer.name}</td>
                    <td>{b.customer.phone}</td>
                    <td>{formatDate(b.checkinDate)}</td>
                    <td>{formatDate(b.checkoutDate)}</td>
                    <td>{billTotal.toLocaleString()}</td>
                    <td>{billPaid.toLocaleString()}</td>
                    <td>
                      {b.bills[0] ? (
                        <a className="btn secondary" href={`/bills/${b.bills[0].id}`}>
                          เปิดบิล
                        </a>
                      ) : (
                        <a className="btn secondary" href="/bills">
                          ออกบิล
                        </a>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        <div className="no-print" style={{ marginTop: 16 }}>
          <PrintButton label="พิมพ์สรุปวันนี้" />
        </div>
      </div>
    </div>
  );
}
