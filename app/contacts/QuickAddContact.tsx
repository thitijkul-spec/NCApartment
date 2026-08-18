"use client";

import { useState, useTransition } from "react";
import type { Contact } from "@prisma/client";
import { createContact } from "./actions";
import { PlusIcon } from "../icons";

export default function QuickAddContact({ label, onCreated }: { label: string; onCreated: (contact: Contact) => void }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createContact(formData);
      if (result?.error) setError(result.error);
      else if (result?.contact) {
        onCreated(result.contact);
        setOpen(false);
      }
    });
  }

  if (!open) {
    return (
      <button type="button" className="secondary" onClick={() => setOpen(true)} style={{ fontSize: 12, marginTop: 6 }}>
        <PlusIcon size={12} /> {label}
      </button>
    );
  }

  return (
    <div className="card" style={{ marginTop: 8, marginBottom: 0, padding: 12 }}>
      {error && <div className="form-error">{error}</div>}
      <form action={submit} className="form-row" style={{ alignItems: "flex-end" }}>
        <div className="field" style={{ flex: 2 }}>
          <label>ชื่อ/ชื่อกิจการ *</label>
          <input name="name" required autoFocus />
        </div>
        <div className="field">
          <label>เบอร์โทร</label>
          <input name="phone" />
        </div>
        <div className="field">
          <label>เลขผู้เสียภาษี</label>
          <input name="taxId" />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" className="secondary" onClick={() => setOpen(false)}>
            ยกเลิก
          </button>
          <button type="submit" disabled={pending}>
            {pending ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </form>
    </div>
  );
}
