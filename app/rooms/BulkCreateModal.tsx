"use client";

import { useState, useTransition } from "react";
import { bulkCreateRooms } from "./actions";
import { XIcon, TrashIcon, PlusIcon } from "../icons";

type Row = {
  roomNumber: string;
  floor: number;
  rentalTypeSupport: string;
  monthlyPrice: number | null;
  dailyPrice: number | null;
  status: string;
};

export default function BulkCreateModal({ onClose, onSaved }: { onClose: () => void; onSaved: (msg: string) => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [floorStart, setFloorStart] = useState(1);
  const [floorEnd, setFloorEnd] = useState(1);
  const [numberStart, setNumberStart] = useState(1);
  const [numberEnd, setNumberEnd] = useState(10);
  const [useFloorPrefix, setUseFloorPrefix] = useState(true);
  const [rentalTypeSupport, setRentalTypeSupport] = useState("monthly");
  const [monthlyPrice, setMonthlyPrice] = useState<number | "">("");
  const [dailyPrice, setDailyPrice] = useState<number | "">("");
  const [rows, setRows] = useState<Row[]>([]);

  function generate() {
    const next: Row[] = [];
    for (let floor = floorStart; floor <= floorEnd; floor++) {
      for (let seq = numberStart; seq <= numberEnd; seq++) {
        const roomNumber = useFloorPrefix ? `${floor}${String(seq).padStart(2, "0")}` : String(seq);
        next.push({
          roomNumber,
          floor,
          rentalTypeSupport,
          monthlyPrice: monthlyPrice === "" ? null : Number(monthlyPrice),
          dailyPrice: dailyPrice === "" ? null : Number(dailyPrice),
          status: "available",
        });
      }
    }
    setRows(next);
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function handleSubmit() {
    setError(null);
    if (rows.length === 0) {
      setError("กรุณากด \"สร้างตัวอย่าง\" ก่อน");
      return;
    }
    const formData = new FormData();
    formData.set("rowsJson", JSON.stringify(rows));
    startTransition(async () => {
      const result = await bulkCreateRooms(formData);
      if (result?.error) setError(result.error);
      else {
        onSaved(`สร้างห้องพักสำเร็จ ${rows.length} ห้อง`);
        onClose();
      }
    });
  }

  const floorGroups = Array.from(new Set(rows.map((r) => r.floor))).sort((a, b) => a - b);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>สร้างห้องพักหลายห้อง</h2>
          <button className="modal-close" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}

          <div className="form-row">
            <div className="field">
              <label>ชั้นเริ่มต้น</label>
              <input type="number" value={floorStart} onChange={(e) => setFloorStart(Number(e.target.value))} />
            </div>
            <div className="field">
              <label>ชั้นสิ้นสุด</label>
              <input type="number" value={floorEnd} onChange={(e) => setFloorEnd(Number(e.target.value))} />
            </div>
            <div className="field">
              <label>เลขห้องเริ่มต้น</label>
              <input type="number" value={numberStart} onChange={(e) => setNumberStart(Number(e.target.value))} />
            </div>
            <div className="field">
              <label>เลขห้องสิ้นสุด</label>
              <input type="number" value={numberEnd} onChange={(e) => setNumberEnd(Number(e.target.value))} />
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 12 }}>
            <input type="checkbox" checked={useFloorPrefix} onChange={(e) => setUseFloorPrefix(e.target.checked)} />
            ใช้เลขชั้นนำหน้า (เช่น 101, 102, ...)
          </label>

          <div className="form-row">
            <div className="field">
              <label>ประเภทการรองรับ</label>
              <select value={rentalTypeSupport} onChange={(e) => setRentalTypeSupport(e.target.value)}>
                <option value="monthly">รายเดือน</option>
                <option value="daily">รายวัน</option>
                <option value="both">รายวัน+รายเดือน</option>
              </select>
            </div>
            <div className="field">
              <label>ราคารายเดือน (บาท)</label>
              <input type="number" value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div className="field">
              <label>ราคารายวัน (บาท)</label>
              <input type="number" value={dailyPrice} onChange={(e) => setDailyPrice(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
          </div>

          <button type="button" onClick={generate}>
            สร้างตัวอย่าง
          </button>

          {rows.length > 0 && (
            <div style={{ marginTop: 16 }}>
              {floorGroups.map((floor) => (
                <div key={floor} style={{ marginBottom: 16 }}>
                  <div className="floor-badge" style={{ marginBottom: 8, display: "inline-block" }}>
                    ชั้น {floor}
                  </div>
                  <table className="bulk-table">
                    <thead>
                      <tr>
                        <th>เลขห้อง</th>
                        <th>ประเภท</th>
                        <th>รายเดือน</th>
                        <th>รายวัน</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) =>
                        r.floor !== floor ? null : (
                          <tr key={i}>
                            <td>
                              <input value={r.roomNumber} onChange={(e) => updateRow(i, { roomNumber: e.target.value })} />
                            </td>
                            <td>
                              <select value={r.rentalTypeSupport} onChange={(e) => updateRow(i, { rentalTypeSupport: e.target.value })}>
                                <option value="monthly">รายเดือน</option>
                                <option value="daily">รายวัน</option>
                                <option value="both">ทั้งคู่</option>
                              </select>
                            </td>
                            <td>
                              <input
                                type="number"
                                value={r.monthlyPrice ?? ""}
                                onChange={(e) => updateRow(i, { monthlyPrice: e.target.value === "" ? null : Number(e.target.value) })}
                              />
                            </td>
                            <td>
                              <input
                                type="number"
                                value={r.dailyPrice ?? ""}
                                onChange={(e) => updateRow(i, { dailyPrice: e.target.value === "" ? null : Number(e.target.value) })}
                              />
                            </td>
                            <td>
                              <button type="button" className="plain-icon-btn" onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}>
                                <TrashIcon size={16} />
                              </button>
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              ))}
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setRows((prev) => [
                    ...prev,
                    { roomNumber: "", floor: floorGroups[floorGroups.length - 1] ?? floorStart, rentalTypeSupport, monthlyPrice: monthlyPrice === "" ? null : Number(monthlyPrice), dailyPrice: dailyPrice === "" ? null : Number(dailyPrice), status: "available" },
                  ])
                }
              >
                <PlusIcon size={14} /> เพิ่มแถว
              </button>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
            รวม {rows.length} ห้อง / {floorGroups.length} ชั้น
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="secondary" onClick={onClose}>
              ยกเลิก
            </button>
            <button type="button" onClick={handleSubmit} disabled={pending}>
              สร้างทั้งหมด ({rows.length} ห้อง)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
