"use client";

import { useState, useTransition } from "react";
import type { Room, Technician } from "./types";
import { createAirconBatch } from "./actions";
import { XIcon } from "../icons";

export default function AirconBatchModal({
  rooms,
  technicians,
  onClose,
  onSaved,
}: {
  rooms: Room[];
  technicians: Technician[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSubmit(formData: FormData) {
    setError(null);
    if (selected.size === 0) {
      setError("กรุณาเลือกอย่างน้อย 1 ห้อง");
      return;
    }
    selected.forEach((id) => formData.append("roomIds", String(id)));
    startTransition(async () => {
      const result = await createAirconBatch(formData);
      if (result?.error) setError(result.error);
      else {
        onSaved(`บันทึกล้างแอร์ ${result?.count ?? selected.size} ห้องแล้ว`);
        onClose();
      }
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>บันทึกล้างแอร์หลายห้อง</h2>
          <button className="modal-close" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        <form action={handleSubmit}>
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}
            <div className="form-row">
              <div className="field">
                <label>วันที่ล้าง</label>
                <input name="date" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="field">
                <label>ช่าง</label>
                <select name="technicianId" defaultValue="">
                  <option value="">-- ไม่ระบุ --</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="field">
              <label>หมายเหตุ</label>
              <input name="notes" />
            </div>
            <div className="field">
              <label>เลือกห้อง ({selected.size} ห้อง)</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, maxHeight: 220, overflowY: "auto" }}>
                {rooms.map((r) => (
                  <label key={r.id} className={`tab${selected.has(r.id) ? " active" : ""}`} style={{ cursor: "pointer" }}>
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} style={{ marginRight: 4 }} />
                    {r.roomNumber}
                  </label>
                ))}
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="secondary" onClick={onClose}>
              ยกเลิก
            </button>
            <button type="submit" disabled={pending}>
              {pending ? "กำลังบันทึก..." : `บันทึก (${selected.size} ห้อง)`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
