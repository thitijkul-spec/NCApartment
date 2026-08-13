import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { addPayment, cancelBill } from "../actions";
import PrintButton from "../PrintButton";
import { getCurrentUser, hasModuleAccess } from "@/lib/auth";

const statusLabel: Record<string, string> = {
  issued: "รอชำระ",
  partial: "ชำระบางส่วน",
  paid: "ชำระแล้ว",
  cancelled: "ยกเลิก",
};

const methodLabel: Record<string, string> = {
  cash: "เงินสด",
  transfer: "โอนเงิน",
  promptpay: "พร้อมเพย์",
  other: "อื่นๆ",
};

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

export default async function BillDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasModuleAccess(user, "B")) {
    return <div className="card">ไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
  }

  const billId = Number(params.id);
  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: {
      room: true,
      customer: true,
      payments: { orderBy: { paymentDate: "asc" } },
    },
  });

  if (!bill) notFound();

  const paid = bill.payments.reduce((s, p) => s + p.amount, 0);
  const remaining = Math.max(0, bill.totalAmount - paid);

  return (
    <div>
      <h1 className="page-title no-print">
        <a href="/bills" style={{ color: "var(--muted)", fontSize: 15, marginRight: 8 }}>
          ← กลับ
        </a>
        บิล #{bill.id}
      </h1>

      <div className="card">
        <div className="receipt-header">
          <div>
            <h2 style={{ marginBottom: 4 }}>ใบแจ้งหนี้ / ใบเสร็จ</h2>
            <div style={{ color: "var(--muted)", fontSize: 14 }}>เลขที่บิล #{bill.id}</div>
          </div>
          <span className={`badge ${bill.status === "paid" ? "available" : bill.status === "cancelled" ? "blocked" : "unavailable"}`}>
            {statusLabel[bill.status] ?? bill.status}
          </span>
        </div>

        <table>
          <tbody>
            <tr>
              <th>ห้อง</th>
              <td>{bill.room.roomNumber}</td>
              <th>ลูกค้า</th>
              <td>
                {bill.customer.name} ({bill.customer.phone})
              </td>
            </tr>
            <tr>
              <th>งวด</th>
              <td>
                {formatDate(bill.billingPeriodStart)} - {formatDate(bill.billingPeriodEnd)}
              </td>
              <th>ครบกำหนดชำระ</th>
              <td>{formatDate(bill.dueDate)}</td>
            </tr>
          </tbody>
        </table>

        <table style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>รายการ</th>
              <th>จำนวนเงิน (บาท)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>ค่าห้อง</td>
              <td>{bill.roomCharge.toLocaleString()}</td>
            </tr>
            {bill.waterCharge > 0 && (
              <tr>
                <td>ค่าน้ำ</td>
                <td>{bill.waterCharge.toLocaleString()}</td>
              </tr>
            )}
            {bill.electricCharge > 0 && (
              <tr>
                <td>ค่าไฟ</td>
                <td>{bill.electricCharge.toLocaleString()}</td>
              </tr>
            )}
            {bill.otherCharges > 0 && (
              <tr>
                <td>ค่าใช้จ่ายอื่นๆ{bill.otherChargesNote ? ` (${bill.otherChargesNote})` : ""}</td>
                <td>{bill.otherCharges.toLocaleString()}</td>
              </tr>
            )}
            {bill.discountAmount > 0 && (
              <tr>
                <td>ส่วนลด</td>
                <td>-{bill.discountAmount.toLocaleString()}</td>
              </tr>
            )}
            <tr>
              <th>ยอดรวมสุทธิ</th>
              <th className="receipt-total">{bill.totalAmount.toLocaleString()}</th>
            </tr>
            <tr>
              <td>ชำระแล้ว</td>
              <td>{paid.toLocaleString()}</td>
            </tr>
            <tr>
              <th>คงเหลือ</th>
              <th>{remaining.toLocaleString()}</th>
            </tr>
          </tbody>
        </table>

        <h2 style={{ marginTop: 24 }}>ประวัติการชำระเงิน</h2>
        {bill.payments.length === 0 ? (
          <p className="empty">ยังไม่มีการชำระเงิน</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>วันที่</th>
                <th>จำนวนเงิน</th>
                <th>ช่องทาง</th>
                <th>หมายเหตุ</th>
              </tr>
            </thead>
            <tbody>
              {bill.payments.map((p) => (
                <tr key={p.id}>
                  <td>{formatDate(p.paymentDate)}</td>
                  <td>{p.amount.toLocaleString()}</td>
                  <td>{methodLabel[p.paymentMethod] ?? p.paymentMethod}</td>
                  <td>{p.note ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div className="no-print" style={{ marginTop: 16 }}>
          {remaining > 0 && bill.status !== "cancelled" && (
            <form action={addPayment} className="form-row">
              <input type="hidden" name="billId" value={bill.id} />
              <div className="field">
                <label>จำนวนเงินที่รับ (บาท)</label>
                <input name="amount" type="number" step="0.01" max={remaining} required />
              </div>
              <div className="field">
                <label>วันที่รับเงิน</label>
                <input name="paymentDate" type="date" required />
              </div>
              <div className="field">
                <label>ช่องทาง</label>
                <select name="paymentMethod">
                  <option value="cash">เงินสด</option>
                  <option value="transfer">โอนเงิน</option>
                  <option value="promptpay">พร้อมเพย์</option>
                  <option value="other">อื่นๆ</option>
                </select>
              </div>
              <div className="field">
                <label>หมายเหตุ</label>
                <input name="note" />
              </div>
              <button type="submit">บันทึกการชำระเงิน</button>
            </form>
          )}

          <div className="status-buttons" style={{ marginTop: 12 }}>
            <PrintButton />
            {bill.status !== "cancelled" && paid === 0 && (
              <form action={cancelBill.bind(null, bill.id)}>
                <button type="submit" className="secondary">
                  ยกเลิกบิล
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
