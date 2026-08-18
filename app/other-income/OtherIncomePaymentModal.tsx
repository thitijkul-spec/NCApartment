"use client";

import { useState, useTransition } from "react";
import { addOtherIncomePayment, deleteOtherIncomePayment } from "./actions";
import { formatDateBE } from "@/lib/date-utils";
import type { OtherIncomeWithRelations } from "./types";
import type { Account } from "@prisma/client";
import { XIcon, TrashIcon } from "../icons";

export default function OtherIncomePaymentModal({
  item,
  accounts,
  onClose,
  onSaved,
}: {
  item: OtherIncomeWithRelations;
  accounts: Account[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const paid = item.payments.reduce((s, p) => s + p.amount, 0);
  const balance = item.totalAmount - paid;

  function submit(formData: FormData) {
    setError(null);
    formData.set("otherIncomeId", String(item.id));
    startTransition(async () => {
      const result = await addOtherIncomePayment(formData);
      if (result?.error) setError(result.error);
      else onSaved("บันทึกการรับเงินแล้ว");
    });
  }

  function handleDeletePayment(paymentId: number) {
    if (!confirm("ยืนยันลบรายการรับเงินนี้?")) return;
    const formData = new FormData();
    formData.set("paymentId", String(paymentId));
    startTransition(async () => {
      await deleteOtherIncomePayment(formData);
      onSaved("ลบรายการรับเงินแล้ว");
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>จัดการการรับเงิน — {item.documentNo}</h2>
          <button className="modal-close" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}
          <p>
            ยอดรวม ฿{item.totalAmount.toLocaleString()} · รับแล้ว ฿{paid.toLocaleString()} · คงเหลือ{" "}
            <strong>฿{balance.toLocaleString()}</strong>
          </p>

          {item.payments.length > 0 && (
            <table style={{ marginBottom: 16 }}>
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>จำนวนเงิน</th>
                  <th>วิธีรับ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {item.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDateBE(p.date)}</td>
                    <td>฿{p.amount.toLocaleString()}</td>
                    <td>{p.method}</td>
                    <td>
                      <button type="button" className="plain-icon-btn" onClick={() => handleDeletePayment(p.id)}>
                        <TrashIcon size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {balance > 0 && (
            <form action={submit} className="form-row" style={{ alignItems: "flex-end" }}>
              <div className="field">
                <label>จำนวนเงิน</label>
                <input name="amount" type="number" step="0.01" defaultValue={balance} required />
              </div>
              <div className="field">
                <label>วิธีรับ</label>
                <select name="method" defaultValue="cash">
                  <option value="cash">เงินสด</option>
                  <option value="transfer">โอนธนาคาร</option>
                  <option value="check">เช็ค</option>
                  <option value="credit_card">บัตรเครดิต</option>
                </select>
              </div>
              <div className="field">
                <label>บัญชี</label>
                <select name="accountId" required defaultValue="">
                  <option value="">-- เลือกบัญชี --</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>วันที่</label>
                <input name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="field">
                <label>สลิป</label>
                <input name="slipImage" type="file" accept="image/*" />
              </div>
              <div>
                <button type="submit" disabled={pending}>
                  + เพิ่มการรับเงิน
                </button>
              </div>
            </form>
          )}
        </div>
        <div className="modal-footer" style={{ justifyContent: "flex-end" }}>
          <button className="secondary" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
