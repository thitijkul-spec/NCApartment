import { prisma } from "@/lib/prisma";
import { getDefaultBranch } from "../rooms/actions";
import { createDailyBill, createMonthlyBill } from "./actions";
import { getCurrentUser, hasModuleAccess } from "@/lib/auth";
import { redirect } from "next/navigation";

const statusLabel: Record<string, string> = {
  issued: "รอชำระ",
  partial: "ชำระบางส่วน",
  paid: "ชำระแล้ว",
  cancelled: "ยกเลิก",
};

const statusClass: Record<string, string> = {
  issued: "unavailable",
  partial: "unavailable",
  paid: "available",
  cancelled: "blocked",
};

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

export default async function BillsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasModuleAccess(user, "B")) {
    return <div className="card">ไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
  }

  const branch = await getDefaultBranch();

  const bills = await prisma.bill.findMany({
    where: { branchId: branch.id },
    include: { room: true, customer: true, payments: true },
    orderBy: { id: "desc" },
  });

  const activeContracts = await prisma.contract.findMany({
    where: { status: "active" },
    include: { room: true, customer: true },
    orderBy: { id: "desc" },
  });

  const bookings = await prisma.booking.findMany({
    where: { status: { in: ["checked_in", "checked_out"] } },
    include: { room: true, customer: true },
    orderBy: { id: "desc" },
  });

  const today = new Date();

  return (
    <div>
      <h1 className="page-title">รายได้ (บิลและใบเสร็จ)</h1>

      <div className="card">
        <h2>รายการบิลทั้งหมด</h2>
        {bills.length === 0 ? (
          <p className="empty">ยังไม่มีบิล</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ห้อง</th>
                <th>ลูกค้า</th>
                <th>งวด</th>
                <th>ยอดรวม</th>
                <th>ชำระแล้ว</th>
                <th>คงเหลือ</th>
                <th>ครบกำหนด</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {bills.map((b) => {
                const paid = b.payments.reduce((s, p) => s + p.amount, 0);
                const remaining = Math.max(0, b.totalAmount - paid);
                const isOverdue =
                  (b.status === "issued" || b.status === "partial") &&
                  new Date(b.dueDate) < today;
                const displayStatus = isOverdue ? "overdue" : b.status;
                return (
                  <tr key={b.id}>
                    <td>{b.room.roomNumber}</td>
                    <td>{b.customer.name}</td>
                    <td>
                      {formatDate(b.billingPeriodStart)} - {formatDate(b.billingPeriodEnd)}
                    </td>
                    <td>{b.totalAmount.toLocaleString()}</td>
                    <td>{paid.toLocaleString()}</td>
                    <td>{remaining.toLocaleString()}</td>
                    <td>{formatDate(b.dueDate)}</td>
                    <td>
                      <span className={`badge ${isOverdue ? "blocked" : statusClass[b.status] ?? ""}`}>
                        {isOverdue ? "ค้างชำระเกินกำหนด" : statusLabel[b.status] ?? b.status}
                      </span>
                    </td>
                    <td>
                      <a className="btn secondary" href={`/bills/${b.id}`}>
                        เปิดบิล
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>ออกบิลรายเดือน (จากสัญญา)</h2>
        {activeContracts.length === 0 ? (
          <p className="empty">ยังไม่มีสัญญาที่กำลังเช่าอยู่</p>
        ) : (
          <form action={createMonthlyBill} className="form-row">
            <div className="field">
              <label>สัญญา</label>
              <select name="contractId" required>
                <option value="">เลือกสัญญา</option>
                {activeContracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    ห้อง {c.room.roomNumber} — {c.customer.name} ({c.monthlyRate}/เดือน)
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>งวดเริ่ม</label>
              <input name="billingPeriodStart" type="date" required />
            </div>
            <div className="field">
              <label>งวดสิ้นสุด</label>
              <input name="billingPeriodEnd" type="date" required />
            </div>
            <div className="field">
              <label>ค่าเช่า (บาท)</label>
              <input name="roomCharge" type="number" step="0.01" placeholder="ค่าเช่าตามสัญญา" />
            </div>
            <div className="field">
              <label>ค่าน้ำ (บาท)</label>
              <input name="waterCharge" type="number" step="0.01" defaultValue={0} />
            </div>
            <div className="field">
              <label>ค่าไฟ (บาท)</label>
              <input name="electricCharge" type="number" step="0.01" defaultValue={0} />
            </div>
            <div className="field">
              <label>ค่าใช้จ่ายอื่นๆ (บาท)</label>
              <input name="otherCharges" type="number" step="0.01" defaultValue={0} />
            </div>
            <div className="field">
              <label>หมายเหตุค่าอื่นๆ</label>
              <input name="otherChargesNote" />
            </div>
            <div className="field">
              <label>ส่วนลด (บาท)</label>
              <input name="discountAmount" type="number" step="0.01" defaultValue={0} />
            </div>
            <div className="field">
              <label>ครบกำหนดชำระ</label>
              <input name="dueDate" type="date" required />
            </div>
            <button type="submit">ออกบิล</button>
          </form>
        )}
      </div>

      <div className="card">
        <h2>ออกบิลรายวัน (จากการจอง)</h2>
        {bookings.length === 0 ? (
          <p className="empty">ยังไม่มีการจองที่เช็คอิน/เช็คเอาท์แล้ว</p>
        ) : (
          <form action={createDailyBill} className="form-row">
            <div className="field">
              <label>การจอง</label>
              <select name="bookingId" required>
                <option value="">เลือกการจอง</option>
                {bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    ห้อง {b.room.roomNumber} — {b.customer.name} ({b.totalAmount} บาท)
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>ค่าใช้จ่ายอื่นๆ (บาท)</label>
              <input name="otherCharges" type="number" step="0.01" defaultValue={0} />
            </div>
            <div className="field">
              <label>หมายเหตุค่าอื่นๆ</label>
              <input name="otherChargesNote" />
            </div>
            <div className="field">
              <label>ส่วนลด (บาท)</label>
              <input name="discountAmount" type="number" step="0.01" defaultValue={0} />
            </div>
            <div className="field">
              <label>ครบกำหนดชำระ</label>
              <input name="dueDate" type="date" required />
            </div>
            <button type="submit">ออกบิล</button>
          </form>
        )}
      </div>
    </div>
  );
}
