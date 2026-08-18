"use client";

import { useState, useTransition } from "react";
import { createContact, updateContact } from "./actions";
import type { Contact } from "@prisma/client";
import { XIcon } from "../icons";

export default function ContactFormModal({
  contact,
  onClose,
  onSaved,
}: {
  contact: Contact | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    setError(null);
    if (contact) formData.set("contactId", String(contact.id));

    startTransition(async () => {
      const result = contact ? await updateContact(formData) : await createContact(formData);
      if (result?.error) setError(result.error);
      else {
        onSaved(contact ? "บันทึกการแก้ไขแล้ว" : "เพิ่มผู้ซื้อ/ผู้ขายแล้ว");
        onClose();
      }
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{contact ? "แก้ไขผู้ซื้อ/ผู้ขาย" : "เพิ่มผู้ซื้อ/ผู้ขาย"}</h2>
          <button className="modal-close" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        <form action={submit}>
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}
            <div className="field">
              <label>ชื่อ/ชื่อกิจการ *</label>
              <input name="name" defaultValue={contact?.name ?? ""} required />
            </div>
            <div className="form-row">
              <div className="field">
                <label>เลขผู้เสียภาษี</label>
                <input name="taxId" defaultValue={contact?.taxId ?? ""} />
              </div>
              <div className="field">
                <label>ชื่อผู้ติดต่อ</label>
                <input name="contactPerson" defaultValue={contact?.contactPerson ?? ""} />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>เบอร์โทร</label>
                <input name="phone" defaultValue={contact?.phone ?? ""} />
              </div>
              <div className="field">
                <label>อีเมล</label>
                <input name="email" type="email" defaultValue={contact?.email ?? ""} />
              </div>
            </div>
            <div className="field">
              <label>ที่อยู่</label>
              <textarea name="address" defaultValue={contact?.address ?? ""} rows={2} />
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
