"use client";

import { useState, useTransition } from "react";
import { createRepairRequest } from "./actions";
import type { Room, Technician, RepairCategory } from "./types";
import { XIcon } from "../icons";

export default function RepairFormModal({
  rooms,
  categories,
  technicians,
  defaultRoomId,
  onClose,
  onSaved,
}: {
  rooms: Room[];
  categories: RepairCategory[];
  technicians: Technician[];
  defaultRoomId?: number;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createRepairRequest(formData);
      if (result?.error) setError(result.error);
      else {
        onSaved("แจ้งซ่อมแล้ว");
        onClose();
      }
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>แจ้งซ่อม</h2>
          <button className="modal-close" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        <form action={handleSubmit}>
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}
            <div className="form-row">
              <div className="field">
                <label>ห้อง *</label>
                <select name="roomId" required defaultValue={defaultRoomId ?? ""}>
                  <option value="">-- เลือกห้อง --</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.roomNumber}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>ประเภทงาน *</label>
                <select name="categoryId" required>
                  <option value="">-- เลือกประเภท --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>ความเร่งด่วน</label>
                <select name="priority" defaultValue="medium">
                  <option value="low">ต่ำ</option>
                  <option value="medium">ปานกลาง</option>
                  <option value="high">สูง</option>
                  <option value="urgent">เร่งด่วน</option>
                </select>
              </div>
            </div>
            <div className="field">
              <label>หัวข้อ *</label>
              <input name="title" required />
            </div>
            <div className="field">
              <label>รายละเอียด</label>
              <textarea name="description" rows={3} />
            </div>
            <div className="field">
              <label>มอบหมายช่าง (ไม่บังคับ)</label>
              <select name="technicianId" defaultValue="">
                <option value="">-- ยังไม่มอบหมาย --</option>
                {technicians
                  .filter((t) => t.active)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="field">
              <label>รูปประกอบ (ไม่บังคับ, สูงสุด 5 รูป)</label>
              <input name="photos" type="file" accept="image/*" multiple />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="secondary" onClick={onClose}>
              ยกเลิก
            </button>
            <button type="submit" disabled={pending}>
              {pending ? "กำลังบันทึก..." : "แจ้งซ่อม"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
