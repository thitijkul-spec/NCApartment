import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { formatDateBE } from "@/lib/date-utils";
import PrintButton from "../receipts/[paymentId]/PrintButton";

const ITEM_LABEL: Record<string, string> = {
  rent: "ค่าเช่า",
  water: "ค่าน้ำ",
  electric: "ค่าไฟ",
  internet: "ค่าอินเทอร์เน็ต",
  common_area: "ค่าส่วนกลาง",
  extra_fee: "ค่าใช้จ่ายอื่นๆ",
  deposit: "เงินประกัน",
  advance_rent: "เงินล่วงหน้า",
  equipment_electrical: "ค่าอุปกรณ์ไฟฟ้า",
  equipment_furniture: "ค่าครุภัณฑ์/เฟอร์นิเจอร์",
  late_fee: "ค่าปรับล่าช้า",
};

export default async function BillsPrintPage({ searchParams }: { searchParams: { ids?: string } }) {
  const { building } = await requireAccess("finance");
  const ids = (searchParams.ids || "")
    .split(",")
    .map(Number)
    .filter((n) => !isNaN(n));

  const bills = await prisma.bill.findMany({
    where: { id: { in: ids }, buildingId: building.id },
    include: { room: true, tenant: true, lineItems: true, payments: true },
    orderBy: { room: { roomNumber: "asc" } },
  });

  return (
    <div>
      <div className="no-print" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
        <a href="/bills" className="secondary btn">
          ← กลับรายการบิล
        </a>
        <PrintButton />
      </div>

      {bills.length === 0 && <p className="empty">ไม่พบบิลที่เลือก</p>}

      {bills.map((bill, i) => {
        const total = bill.lineItems.reduce((s, li) => s + li.amount, 0) - (bill.discountAmount ?? 0);
        const paid = bill.payments.reduce((s, p) => s + p.amount, 0);
        const balance = total - paid;
        return (
          <div key={bill.id} className={i < bills.length - 1 ? "print-page-break" : ""}>
            <div className="card" style={{ maxWidth: 560, margin: "0 auto 16px" }}>
              <div className="receipt-header">
                <div>
                  <h2 style={{ margin: 0 }}>{building.name}</h2>
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>บิลเลขที่ {bill.billNo}</p>
                </div>
                <span className={`badge ${bill.status === "paid" ? "success" : bill.status === "cancelled" ? "neutral" : "warning"}`}>
                  {bill.status === "unpaid" ? "ค้างชำระ" : bill.status === "partially_paid" ? "จ่ายบางส่วน" : bill.status === "paid" ? "ชำระแล้ว" : "ยกเลิก"}
                </span>
              </div>
              <p style={{ fontSize: 14 }}>
                ห้อง {bill.room.roomNumber} · ผู้เช่า {bill.tenant.name} · งวด {bill.billingMonth}
                <br />
                วันออกบิล {formatDateBE(bill.issueDate)} · ครบกำหนด {formatDateBE(bill.dueDate)}
              </p>

              <table>
                <thead>
                  <tr>
                    <th>รายการ</th>
                    <th>จำนวนเงิน</th>
                  </tr>
                </thead>
                <tbody>
                  {bill.lineItems.map((li) => (
                    <tr key={li.id}>
                      <td>{li.description || ITEM_LABEL[li.itemType] || li.itemType}</td>
                      <td>฿{li.amount.toLocaleString()}</td>
                    </tr>
                  ))}
                  {bill.discountAmount ? (
                    <tr>
                      <td>ส่วนลด</td>
                      <td>-฿{bill.discountAmount.toLocaleString()}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>

              <div className="receipt-total" style={{ textAlign: "right", marginTop: 12 }}>
                รวม ฿{total.toLocaleString()}
              </div>
              <p style={{ textAlign: "right", fontSize: 14, color: "var(--text-muted)" }}>
                ชำระแล้ว ฿{paid.toLocaleString()} · คงเหลือ ฿{balance.toLocaleString()}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
