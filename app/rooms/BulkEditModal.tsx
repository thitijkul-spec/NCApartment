"use client";

import { useState, useTransition } from "react";
import { bulkUpdateRooms } from "./actions";
import type { RoomWithRelations } from "./types";
import { XIcon } from "../icons";

export default function BulkEditModal({
  rooms,
  onClose,
  onSaved,
}: {
  rooms: RoomWithRelations[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showList, setShowList] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    rooms.forEach((r) => formData.append("roomIds", String(r.id)));
    startTransition(async () => {
      const result = await bulkUpdateRooms(formData);
      if (result?.error) setError(result.error);
      else {
        onSaved(`บันทึกการแก้ไข ${rooms.length} ห้องแล้ว`);
        onClose();
      }
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>แก้ไขข้อมูลห้องพัก {rooms.length} ห้อง</h2>
          <button className="modal-close" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        <form action={handleSubmit}>
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}
            <div className="bulk-preview-note">
              กำลังแก้ไข {rooms.length} ห้อง —{" "}
              <button type="button" className="plain-icon-btn" style={{ width: "auto", textDecoration: "underline" }} onClick={() => setShowList((s) => !s)}>
                {showList ? "ซ่อนรายชื่อ" : "ดูห้องที่เลือก"}
              </button>
            </div>
            {showList && (
              <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: -8 }}>{rooms.map((r) => r.roomNumber).join(", ")}</p>
            )}
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>เว้นว่างช่องไหนไว้ = ห้องนั้นจะไม่ถูกเปลี่ยนค่าฟิลด์นั้น</p>

            <div className="field">
              <label>ประเภทการรองรับ</label>
              <select name="rentalTypeSupport" defaultValue="">
                <option value="">-- ไม่เปลี่ยน --</option>
                <option value="monthly">รายเดือน</option>
                <option value="daily">รายวัน</option>
                <option value="both">รายวัน+รายเดือน</option>
              </select>
            </div>
            <div className="form-row">
              <div className="field">
                <label>ราคารายเดือน</label>
                <input name="monthlyPrice" type="number" placeholder="ไม่เปลี่ยน" />
              </div>
              <div className="field">
                <label>ราคารายวัน</label>
                <input name="dailyPrice" type="number" placeholder="ไม่เปลี่ยน" />
              </div>
            </div>
            <div className="form-row">
              <div className="field">
                <label>มัดจำรายเดือน</label>
                <input name="monthlyDeposit" type="number" placeholder="ไม่เปลี่ยน" />
              </div>
              <div className="field">
                <label>มัดจำรายวัน</label>
                <input name="dailyDeposit" type="number" placeholder="ไม่เปลี่ยน" />
              </div>
            </div>
            <div className="field">
              <label>สถานะ</label>
              <select name="status" defaultValue="">
                <option value="">-- ไม่เปลี่ยน --</option>
                <option value="available">ว่าง</option>
                <option value="maintenance">ปิดปรับปรุง</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="secondary" onClick={onClose}>
              ยกเลิก
            </button>
            <button type="submit" disabled={pending}>
              บันทึกทั้ง {rooms.length} ห้อง
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
