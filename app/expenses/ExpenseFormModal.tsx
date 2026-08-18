"use client";

import { useState, useTransition } from "react";
import { createExpense, updateExpense } from "./actions";
import { EXPENSE_CATEGORIES } from "./types";
import type { ExpenseWithRelations } from "./types";
import type { Contact, Account } from "@prisma/client";
import { XIcon, PlusIcon, TrashIcon } from "../icons";
import QuickAddContact from "../contacts/QuickAddContact";

type Line = { title: string; category: string; amount: string; vatMode: string; vatRate: string; description: string };

function emptyLine(): Line {
  return { title: "", category: "อื่นๆ", amount: "", vatMode: "none", vatRate: "7", description: "" };
}

export default function ExpenseFormModal({
  expense,
  contacts,
  accounts,
  onClose,
  onSaved,
}: {
  expense: ExpenseWithRelations | null;
  contacts: Contact[];
  accounts: Account[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [purchaseType, setPurchaseType] = useState(expense?.purchaseType ?? "cash");
  const [contactList, setContactList] = useState<Contact[]>(contacts);
  const [vendorContactId, setVendorContactId] = useState(expense?.vendorContactId ? String(expense.vendorContactId) : "");
  const [lines, setLines] = useState<Line[]>(
    expense && expense.lineItems.length > 0
      ? expense.lineItems.map((li) => ({
          title: li.title,
          category: li.category,
          amount: String(li.amount),
          vatMode: li.vatMode,
          vatRate: String(li.vatRate),
          description: li.description ?? "",
        }))
      : [emptyLine()]
  );

  const today = new Date().toISOString().slice(0, 10);

  const total = lines.reduce((sum, l) => {
    const amount = Number(l.amount) || 0;
    if (l.vatMode === "excluded") return sum + amount + amount * ((Number(l.vatRate) || 0) / 100);
    return sum + amount;
  }, 0);

  function updateLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  function submit(formData: FormData) {
    setError(null);
    if (expense) formData.set("expenseId", String(expense.id));
    lines.forEach((l) => {
      formData.append("liTitle", l.title);
      formData.append("liCategory", l.category);
      formData.append("liAmount", l.amount);
      formData.append("liVatMode", l.vatMode);
      formData.append("liVatRate", l.vatRate);
      formData.append("liDescription", l.description);
    });

    startTransition(async () => {
      const result = expense ? await updateExpense(formData) : await createExpense(formData);
      if (result?.error) setError(result.error);
      else {
        onSaved(expense ? "บันทึกการแก้ไขแล้ว" : "บันทึกค่าใช้จ่ายแล้ว");
        onClose();
      }
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{expense ? "แก้ไขค่าใช้จ่าย" : "บันทึกค่าใช้จ่าย"}</h2>
          <button className="modal-close" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        <form action={submit}>
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}

            <div className="form-row">
              <div className="field" style={{ flex: 2 }}>
                <label>ผู้ขาย (ไม่บังคับ)</label>
                <select name="vendorContactId" value={vendorContactId} onChange={(e) => setVendorContactId(e.target.value)}>
                  <option value="">-- ไม่ระบุ --</option>
                  {contactList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <QuickAddContact
                  label="เพิ่มผู้ขายใหม่"
                  onCreated={(c) => {
                    setContactList((prev) => [...prev, c]);
                    setVendorContactId(String(c.id));
                  }}
                />
              </div>
              <div className="field">
                <label>วันที่ *</label>
                <input name="date" type="date" required defaultValue={expense ? new Date(expense.date).toISOString().slice(0, 10) : today} />
              </div>
              <div className="field">
                <label>เลขที่ใบกำกับภาษีซื้อ</label>
                <input name="vendorInvoiceNo" defaultValue={expense?.vendorInvoiceNo ?? ""} />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label>ประเภทการซื้อ *</label>
                <select name="purchaseType" value={purchaseType} onChange={(e) => setPurchaseType(e.target.value)}>
                  <option value="cash">ซื้อสด</option>
                  <option value="credit">ซื้อเชื่อ</option>
                </select>
              </div>
              {purchaseType === "credit" && (
                <div className="field">
                  <label>วันครบกำหนด *</label>
                  <input name="dueDate" type="date" required defaultValue={expense?.dueDate ? new Date(expense.dueDate).toISOString().slice(0, 10) : ""} />
                </div>
              )}
              <div className="field">
                <label>ยอดหัก ณ ที่จ่าย (memo)</label>
                <input name="whtAmount" type="number" step="0.01" defaultValue={expense?.whtAmount ?? ""} />
              </div>
            </div>

            {purchaseType === "cash" && !expense && (
              <div className="form-row">
                <div className="field">
                  <label>วิธีจ่าย</label>
                  <select name="payMethod" defaultValue="cash">
                    <option value="cash">เงินสด</option>
                    <option value="transfer">โอนธนาคาร</option>
                    <option value="check">เช็ค</option>
                    <option value="credit_card">บัตรเครดิต</option>
                  </select>
                </div>
                <div className="field">
                  <label>บัญชีที่จ่ายออก</label>
                  <select name="payAccountId" defaultValue="">
                    <option value="">-- เลือกบัญชี --</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            <hr style={{ border: "none", borderTop: "1px solid var(--border)" }} />
            <strong>รายการ</strong>
            {lines.map((l, i) => (
              <div key={i} className="card" style={{ background: "var(--surface-2)", marginBottom: 8 }}>
                <div className="form-row">
                  <div className="field" style={{ flex: 2 }}>
                    <label>หัวข้อ *</label>
                    <input value={l.title} onChange={(e) => updateLine(i, { title: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>ประเภท</label>
                    <select value={l.category} onChange={(e) => updateLine(i, { category: e.target.value })}>
                      {EXPENSE_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>จำนวนเงิน *</label>
                    <input type="number" step="0.01" value={l.amount} onChange={(e) => updateLine(i, { amount: e.target.value })} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="field">
                    <label>VAT</label>
                    <select value={l.vatMode} onChange={(e) => updateLine(i, { vatMode: e.target.value })}>
                      <option value="none">ไม่มี</option>
                      <option value="included">รวมใน amount</option>
                      <option value="excluded">แยกเพิ่ม</option>
                    </select>
                  </div>
                  {l.vatMode !== "none" && (
                    <div className="field">
                      <label>% VAT</label>
                      <input type="number" step="0.01" value={l.vatRate} onChange={(e) => updateLine(i, { vatRate: e.target.value })} />
                    </div>
                  )}
                  <div className="field" style={{ flex: 2 }}>
                    <label>รายละเอียดเพิ่มเติม</label>
                    <input value={l.description} onChange={(e) => updateLine(i, { description: e.target.value })} />
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end" }}>
                    <button type="button" className="plain-icon-btn" onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))} disabled={lines.length === 1}>
                      <TrashIcon size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <button type="button" className="secondary" onClick={() => setLines((p) => [...p, emptyLine()])}>
              <PlusIcon size={14} /> เพิ่มรายการ
            </button>

            <p style={{ marginTop: 12, fontSize: 16, fontWeight: 600 }}>ยอดรวมทั้งบิล: ฿{total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p>

            <div className="field">
              <label>รูปใบเสร็จ (แนบได้หลายไฟล์)</label>
              <input name="receiptImage" type="file" accept="image/*" multiple />
            </div>
            <div className="field">
              <label>หมายเหตุ</label>
              <textarea name="notes" defaultValue={expense?.notes ?? ""} rows={2} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="secondary" onClick={onClose}>
              ยกเลิก
            </button>
            <button type="submit" disabled={pending}>
              {pending ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
