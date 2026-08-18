"use client";

import { useMemo, useState } from "react";
import type { Contact } from "@prisma/client";
import ContactFormModal from "./ContactFormModal";
import { deleteContact } from "./actions";
import { UsersIcon, PlusIcon } from "../icons";

export default function ContactsClient({ contacts, buildingName }: { contacts: Contact[]; buildingName: string }) {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  function handleDelete(c: Contact) {
    if (!confirm(`ยืนยันลบ "${c.name}" ถาวร? (ประวัติค่าใช้จ่าย/รายได้เดิมจะยังอยู่เพราะมี snapshot แยกเก็บไว้แล้ว)`)) return;
    const formData = new FormData();
    formData.set("contactId", String(c.id));
    deleteContact(formData).then(() => notify("ลบแล้ว"));
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.trim().toLowerCase();
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? "").includes(q) ||
        (c.taxId ?? "").includes(q)
    );
  }, [contacts, search]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header-title">
            <UsersIcon size={24} /> ผู้ซื้อและผู้ขาย
          </div>
          <p className="page-header-subtitle">ข้อมูลคู่ค้าที่ใช้ร่วมกันทุกอาคาร — {buildingName}</p>
        </div>
        <div className="page-header-actions">
          <button onClick={() => setShowAdd(true)}>
            <PlusIcon size={16} /> เพิ่มผู้ซื้อ/ผู้ขาย
          </button>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      <input
        placeholder="ค้นหาชื่อ, เบอร์โทร, เลขผู้เสียภาษี..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 16, minWidth: 280 }}
      />

      <table>
        <thead>
          <tr>
            <th>ชื่อ/ชื่อกิจการ</th>
            <th>เลขผู้เสียภาษี</th>
            <th>เบอร์โทร</th>
            <th>อีเมล</th>
            <th>ผู้ติดต่อ</th>
            <th>การดำเนินการ</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((c) => (
            <tr key={c.id}>
              <td>{c.name}</td>
              <td>{c.taxId ?? "-"}</td>
              <td>{c.phone ?? "-"}</td>
              <td>{c.email ?? "-"}</td>
              <td>{c.contactPerson ?? "-"}</td>
              <td>
                <div className="status-buttons">
                  <button className="secondary" onClick={() => setEditingContact(c)}>
                    แก้ไข
                  </button>
                  <button className="danger" onClick={() => handleDelete(c)}>
                    ลบ
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && <p className="empty">ยังไม่มีข้อมูลผู้ซื้อ/ผู้ขาย</p>}

      {showAdd && <ContactFormModal contact={null} onClose={() => setShowAdd(false)} onSaved={notify} />}
      {editingContact && (
        <ContactFormModal contact={editingContact} onClose={() => setEditingContact(null)} onSaved={notify} />
      )}
    </div>
  );
}
