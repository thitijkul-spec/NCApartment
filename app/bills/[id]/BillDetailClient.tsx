"use client";

import { useState, useTransition } from "react";
import type { Bill, BillLineItem, Payment, Room, Tenant, Contract, Account } from "@prisma/client";
import { addPayment, deletePayment, cancelBill, addLateFee } from "../actions";
import { TrashIcon, WalletIcon } from "../../icons";

type BillFull = Bill & {
  room: Room;
  tenant: Tenant;
  contract: Contract;
  lineItems: BillLineItem[];
  payments: (Payment & { account: Account | null })[];
};

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

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

export default function BillDetailClient({ bill, accounts, buildingName }: { bill: BillFull; accounts: Account[]; buildingName: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const total = bill.lineItems.reduce((s, li) => s + li.amount, 0) - (bill.discountAmount ?? 0);
  const paid = bill.payments.reduce((s, p) => s + p.amount, 0);
  const balance = total - paid;

  function handleCancel() {
    if (!confirm(`ยืนยันยกเลิกบิล ${bill.billNo}?`)) return;
    const formData = new FormData();
    formData.set("billId", String(bill.id));
    startTransition(async () => {
      const result = await cancelBill(formData);
      if (result?.error) alert(result.error);
    });
  }

  function handleDeletePayment(paymentId: number) {
    if (!confirm("ยืนยันลบรายการชำระนี้? บิลจะกลับเป็นค้างชำระ")) return;
    const formData = new FormData();
    formData.set("paymentId", String(paymentId));
    startTransition(async () => {
      await deletePayment(formData);
    });
  }

  return (
    <div>
      <div className="no-print" style={{ marginBottom: 16, display: "flex", justifyContent: "space-between" }}>
        <a href="/bills" className="secondary btn">
          ← กลับรายการบิล
        </a>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="secondary" onClick={() => window.print()}>
            พิมพ์บิล (A5)
          </button>
          {bill.status !== "cancelled" && balance > 0 && (
            <button className="danger" onClick={handleCancel} disabled={pending}>
              ยกเลิกบิล
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ maxWidth: 560, margin: "0 auto" }}>
        <div className="receipt-header">
          <div>
            <h2 style={{ margin: 0 }}>{buildingName}</h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>บิลเลขที่ {bill.billNo}</p>
          </div>
          <span className={`badge ${bill.status === "paid" ? "success" : bill.status === "cancelled" ? "neutral" : "warning"}`}>
            {bill.status === "unpaid" ? "ค้างชำระ" : bill.status === "partially_paid" ? "จ่ายบางส่วน" : bill.status === "paid" ? "ชำระแล้ว" : "ยกเลิก"}
          </span>
        </div>
        <p style={{ fontSize: 14 }}>
          ห้อง {bill.room.roomNumber} · ผู้เช่า {bill.tenant.name} · งวด {bill.billingMonth}
          <br />
          วันออกบิล {fmtDate(bill.issueDate)} · ครบกำหนด {fmtDate(bill.dueDate)}
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

        {bill.status !== "cancelled" && (
          <div className="no-print" style={{ marginTop: 8 }}>
            <button type="button" className="secondary" onClick={() => setShowPaymentForm((s) => !s)}>
              {showPaymentForm ? "ปิดฟอร์ม" : "+ เพิ่มค่าปรับล่าช้า"}
            </button>
            {showPaymentForm && <LateFeeForm billId={bill.id} onDone={() => setShowPaymentForm(false)} />}
          </div>
        )}
      </div>

      <div className="card no-print" style={{ maxWidth: 560, margin: "16px auto" }}>
        <h2>
          <WalletIcon size={16} /> การชำระเงิน
        </h2>
        {bill.payments.map((p) => (
          <div key={p.id} style={{ borderBottom: "1px solid var(--border)", padding: "10px 0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>฿{p.amount.toLocaleString()}</strong> · {p.method === "cash" ? "เงินสด" : "โอนเงิน"}
              {p.account && ` (${p.account.name})`}
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                ใบเสร็จ {p.receiptNo} {p.taxInvoiceNo && `· ใบกำกับภาษี ${p.taxInvoiceNo}`} · {fmtDate(p.paidAt)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <a href={`/bills/receipts/${p.id}`} className="secondary btn">
                ใบเสร็จ
              </a>
              <button className="plain-icon-btn" onClick={() => handleDeletePayment(p.id)} disabled={pending}>
                <TrashIcon size={16} />
              </button>
            </div>
          </div>
        ))}
        {bill.payments.length === 0 && <p className="empty">ยังไม่มีการชำระ</p>}

        {bill.status !== "cancelled" && balance > 0 && (
          <PaymentForm key={bill.payments.length} billId={bill.id} accounts={accounts} suggestedAmount={balance} />
        )}
      </div>
    </div>
  );
}

function LateFeeForm({ billId, onDone }: { billId: number; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");

  function submit() {
    const formData = new FormData();
    formData.set("billId", String(billId));
    formData.set("amount", amount);
    startTransition(async () => {
      await addLateFee(formData);
      onDone();
    });
  }

  return (
    <div className="form-row" style={{ marginTop: 8 }}>
      <input type="number" placeholder="จำนวนเงิน" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <button type="button" className="secondary" onClick={submit} disabled={pending}>
        บันทึก
      </button>
    </div>
  );
}

function PaymentForm({ billId, accounts, suggestedAmount }: { billId: number; accounts: Account[]; suggestedAmount: number }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState("cash");
  const [issueTaxInvoice, setIssueTaxInvoice] = useState(false);

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("billId", String(billId));
    startTransition(async () => {
      const result = await addPayment(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={handleSubmit} style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
      {error && <div className="form-error">{error}</div>}
      <div className="form-row">
        <div className="field">
          <label>จำนวนเงิน</label>
          <input name="amount" type="number" step="0.01" defaultValue={suggestedAmount} required />
        </div>
        <div className="field">
          <label>วิธีชำระ</label>
          <select name="method" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">เงินสด</option>
            <option value="transfer">โอนเงิน</option>
          </select>
        </div>
        {method === "transfer" && (
          <div className="field">
            <label>บัญชี</label>
            <select name="accountId">
              <option value="">-- เลือกบัญชี --</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <div className="field">
        <label>สลิปโอนเงิน (ถ้ามี)</label>
        <input name="slipImage" type="file" accept="image/*" />
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input type="checkbox" checked={issueTaxInvoice} onChange={(e) => setIssueTaxInvoice(e.target.checked)} name="issueTaxInvoice" />
        ออกใบกำกับภาษี
      </label>
      {issueTaxInvoice && (
        <div className="form-row" style={{ marginTop: 8 }}>
          <div className="field">
            <label>ชื่อผู้เสียภาษี</label>
            <input name="taxpayerName" />
          </div>
          <div className="field">
            <label>เลขผู้เสียภาษี (13 หลัก)</label>
            <input name="taxpayerTaxId" maxLength={13} />
          </div>
          <div className="field">
            <label>ที่อยู่</label>
            <input name="taxpayerAddress" />
          </div>
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <button type="submit" disabled={pending}>
          {pending ? "กำลังบันทึก..." : "บันทึกการชำระ"}
        </button>
      </div>
    </form>
  );
}
