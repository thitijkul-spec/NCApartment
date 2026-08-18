"use client";

import { useState, useTransition } from "react";
import { createOtherIncome, updateOtherIncome } from "./actions";
import { OTHER_INCOME_CATEGORIES } from "./types";
import type { OtherIncomeWithRelations } from "./types";
import type { Contact, Account, Tenant } from "@prisma/client";
import { XIcon, PlusIcon, TrashIcon } from "../icons";
import QuickAddContact from "../contacts/QuickAddContact";

type Line = { title: string; category: string; amount: string; vatMode: string; vatRate: string; description: string };

function emptyLine(): Line {
  return { title: "", category: "อื่นๆ", amount: "", vatMode: "none", vatRate: "7", description: "" };
}

export default function OtherIncomeFormModal({
  item,
  contacts,
  tenants,
  accounts,
  onClose,
  onSaved,
}: {
  item: OtherIncomeWithRelations | null;
  contacts: Contact[];
  tenants: Tenant[];
  accounts: Account[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saleType, setSaleType] = useState(item?.saleType ?? "cash");
  const [buyerType, setBuyerType] = useState(item?.buyerType ?? "tenant");
  const [tenantSearch, setTenantSearch] = useState("");
  const [contactList, setContactList] = useState<Contact[]>(contacts);
  const [buyerContactId, setBuyerContactId] = useState(item?.buyerContactId ? String(item.buyerContactId) : "");
  const [lines, setLines] = useState<Line[]>(
    item && item.lineItems.length > 0
      ? item.lineItems.map((li) => ({
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
  const filteredTenants = tenants.filter((t) => t.name.toLowerCase().includes(tenantSearch.toLowerCase()));

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
    if (item) formData.set("otherIncomeId", String(item.id));
    lines.forEach((l) => {
      formData.append("liTitle", l.title);
      formData.append("liCategory", l.category);
      formData.append("liAmount", l.amount);
      formData.append("liVatMode", l.vatMode);
      formData.append("liVatRate", l.vatRate);
      formData.append("liDescription", l.description);
    });

    startTransition(async () => {
      const result = item ? await updateOtherIncome(formData) : await createOtherIncome(formData);
      if (result?.error) setError(result.error);
      else {
        onSaved(item ? "บันทึกการแก้ไขแล้ว" : "บันทึกรายได้อื่นๆ แล้ว");
        onClose();
      }
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{item ? "แก้ไขรายได้อื่นๆ" : "บันทึกรายได้อื่นๆ"}</h2>
          <button className="modal-close" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        <form action={submit}>
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}

            <div className="tabs" style={{ marginBottom: 0 }}>
              <button type="button" className={`tab${buyerType === "tenant" ? " active" : ""}`} onClick={() => setBuyerType("tenant")}>
                ผู้เช่าในระบบ
              </button>
              <button type="button" className={`tab${buyerType === "contact" ? " active" : ""}`} onClick={() => setBuyerType("contact")}>
                ลูกค้าทั่วไป
              </button>
            </div>
            <input type="hidden" name="buyerType" value={buyerType} />

            {buyerType === "tenant" ? (
              <div className="field">
                <label>ผู้เช่า *</label>
                <input placeholder="ค้นหาชื่อผู้เช่า..." value={tenantSearch} onChange={(e) => setTenantSearch(e.target.value)} />
                <select name="buyerTenantId" size={4} defaultValue={item?.buyerTenantId ?? ""} style={{ marginTop: 6 }}>
                  {filteredTenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.phone ? `(${t.phone})` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="field">
                <label>ผู้ซื้อ (Contact) *</label>
                <select name="buyerContactId" value={buyerContactId} onChange={(e) => setBuyerContactId(e.target.value)}>
                  <option value="">-- เลือก --</option>
                  {contactList.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <QuickAddContact
                  label="เพิ่มผู้ซื้อใหม่"
                  onCreated={(c) => {
                    setContactList((prev) => [...prev, c]);
                    setBuyerContactId(String(c.id));
                  }}
                />
              </div>
            )}

            <div className="form-row">
              <div className="field">
                <label>วันที่ *</label>
                <input name="date" type="date" required defaultValue={item ? new Date(item.date).toISOString().slice(0, 10) : today} />
              </div>
              <div className="field">
                <label>เลขที่ใบกำกับภาษีขาย</label>
                <input name="saleInvoiceNo" defaultValue={item?.saleInvoiceNo ?? ""} />
              </div>
              <div className="field">
                <label>ยอดหัก ณ ที่จ่าย (memo)</label>
                <input name="whtAmount" type="number" step="0.01" defaultValue={item?.whtAmount ?? ""} />
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label>ประเภทการรับเงิน *</label>
                <select name="saleType" value={saleType} onChange={(e) => setSaleType(e.target.value)}>
                  <option value="cash">รับเงินสดทันที</option>
                  <option value="credit">ขายเชื่อ (ค้างรับ)</option>
                </select>
              </div>
              {saleType === "credit" && (
                <div className="field">
                  <label>วันครบกำหนดรับเงิน *</label>
                  <input name="dueDate" type="date" required defaultValue={item?.dueDate ? new Date(item.dueDate).toISOString().slice(0, 10) : ""} />
                </div>
              )}
            </div>

            {saleType === "cash" && !item && (
              <div className="form-row">
                <div className="field">
                  <label>วิธีรับเงิน</label>
                  <select name="payMethod" defaultValue="cash">
                    <option value="cash">เงินสด</option>
                    <option value="transfer">โอนธนาคาร</option>
                    <option value="check">เช็ค</option>
                    <option value="credit_card">บัตรเครดิต</option>
                  </select>
                </div>
                <div className="field">
                  <label>บัญชีที่รับเงินเข้า</label>
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
                      {OTHER_INCOME_CATEGORIES.map((c) => (
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
              <label>ไฟล์แนบ (แนบได้หลายไฟล์)</label>
              <input name="attachment" type="file" multiple />
            </div>
            <div className="field">
              <label>หมายเหตุ</label>
              <textarea name="notes" defaultValue={item?.notes ?? ""} rows={2} />
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
