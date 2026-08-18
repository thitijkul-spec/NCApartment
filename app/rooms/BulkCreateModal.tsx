"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { bulkCreateRooms } from "./actions";
import { XIcon, TrashIcon, PlusIcon, ZapIcon, ChevronDownIcon } from "../icons";

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
  const [monthlyPrice, setMonthlyPrice] = useState<number | "">("");
  const [dailyPrice, setDailyPrice] = useState<number | "">("");
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [collapsedFloors, setCollapsedFloors] = useState<Set<number>>(new Set());

  const rentalTypeSupport = monthlyPrice !== "" && dailyPrice !== "" ? "both" : dailyPrice !== "" ? "daily" : "monthly";

  useEffect(() => {
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
    setSelected(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorStart, floorEnd, numberStart, numberEnd, useFloorPrefix, rentalTypeSupport, monthlyPrice, dailyPrice]);

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(i);
      return next;
    });
  }

  function toggleRow(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length ? new Set() : new Set(rows.map((_, i) => i))));
  }

  function toggleFloorSelect(floor: number, indices: number[]) {
    const allSelected = indices.every((i) => selected.has(i));
    setSelected((prev) => {
      const next = new Set(prev);
      indices.forEach((i) => (allSelected ? next.delete(i) : next.add(i)));
      return next;
    });
  }

  function toggleCollapse(floor: number) {
    setCollapsedFloors((prev) => {
      const next = new Set(prev);
      if (next.has(floor)) next.delete(floor);
      else next.add(floor);
      return next;
    });
  }

  function removeFloor(indices: number[]) {
    const toRemove = new Set(indices);
    setRows((prev) => prev.filter((_, idx) => !toRemove.has(idx)));
    setSelected(new Set());
  }

  function deleteSelected() {
    setRows((prev) => prev.filter((_, idx) => !selected.has(idx)));
    setSelected(new Set());
  }

  function handleSubmit() {
    setError(null);
    if (rows.length === 0) {
      setError("ไม่มีห้องที่จะสร้าง กรุณาตรวจสอบช่วงชั้น/เลขห้อง");
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

  const floorGroups = useMemo(() => Array.from(new Set(rows.map((r) => r.floor))).sort((a, b) => a - b), [rows]);

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

          <div className="bulk-preview-note" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <strong style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ZapIcon size={15} /> สร้างห้ออัตโนมัติ
            </strong>
            <span style={{ fontSize: 13 }}>กรอกช่วงชั้น เลขห้อง และราคา — ตารางด้านล่างจะแสดงห้องที่จะสร้างให้ทันที</span>
          </div>

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

          <div className="form-row">
            <div className="field">
              <label>ราคารายเดือน (บาท)</label>
              <input type="number" value={monthlyPrice} onChange={(e) => setMonthlyPrice(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
            <div className="field">
              <label>ราคารายวัน (บาท)</label>
              <input type="number" value={dailyPrice} onChange={(e) => setDailyPrice(e.target.value === "" ? "" : Number(e.target.value))} />
            </div>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: -8 }}>
            ประเภทการรองรับกำหนดอัตโนมัติจากราคาที่กรอก — ใส่ทั้งสองราคา = รายวัน+รายเดือน (แก้ไขรายห้องได้ในตาราง)
          </p>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 4 }}>
            <input type="checkbox" checked={useFloorPrefix} onChange={(e) => setUseFloorPrefix(e.target.checked)} />
            ใช้เลขชั้นนำหน้า (เช่น 101, 102, ...)
          </label>

          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            ตารางด้านล่างแสดง {rows.length} ห้อง ตามที่กรอก ({floorGroups.length} ชั้น • {numberEnd - numberStart + 1} ห้อง/ชั้น) — แก้ไขรายห้องในตารางได้
          </p>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, marginBottom: 8 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14 }}>
              <input type="checkbox" checked={rows.length > 0 && selected.size === rows.length} onChange={toggleAll} />
              รายการห้องที่จะสร้าง ({rows.length})
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {selected.size > 0 && (
                <button type="button" className="danger" onClick={deleteSelected}>
                  <TrashIcon size={14} /> ลบที่เลือก ({selected.size})
                </button>
              )}
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setRows((prev) => [
                    ...prev,
                    {
                      roomNumber: "",
                      floor: floorGroups[floorGroups.length - 1] ?? floorStart,
                      rentalTypeSupport,
                      monthlyPrice: monthlyPrice === "" ? null : Number(monthlyPrice),
                      dailyPrice: dailyPrice === "" ? null : Number(dailyPrice),
                      status: "available",
                    },
                  ])
                }
              >
                <PlusIcon size={14} /> เพิ่มแถว
              </button>
            </div>
          </div>

          {rows.length === 0 && <p className="empty">ไม่มีห้องที่จะสร้าง — ปรับช่วงชั้น/เลขห้องด้านบน</p>}

          {floorGroups.map((floor) => {
            const indices = rows.map((r, i) => (r.floor === floor ? i : -1)).filter((i) => i >= 0);
            const allSelected = indices.length > 0 && indices.every((i) => selected.has(i));
            const collapsed = collapsedFloors.has(floor);
            return (
              <div key={floor} style={{ marginBottom: 14, border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 12px",
                    background: "var(--surface-2)",
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <input type="checkbox" checked={allSelected} onChange={() => toggleFloorSelect(floor, indices)} onClick={(e) => e.stopPropagation()} />
                    <span className="floor-badge">ชั้น {floor}</span>
                    <span className="floor-count">{indices.length} ห้อง</span>
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <button type="button" className="plain-icon-btn" onClick={() => removeFloor(indices)} title="ลบทั้งชั้น">
                      <TrashIcon size={16} />
                    </button>
                    <button
                      type="button"
                      className="plain-icon-btn"
                      onClick={() => toggleCollapse(floor)}
                      style={{ transform: collapsed ? "rotate(-90deg)" : "none" }}
                      title={collapsed ? "ขยาย" : "ย่อ"}
                    >
                      <ChevronDownIcon size={16} />
                    </button>
                  </div>
                </div>
                {!collapsed && (
                  <table className="bulk-table">
                    <thead>
                      <tr>
                        <th></th>
                        <th>เลขห้อง</th>
                        <th>ประเภท</th>
                        <th>ราคา/เดือน</th>
                        <th>ราคา/วัน</th>
                        <th>สถานะ</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {indices.map((i) => {
                        const r = rows[i];
                        return (
                          <tr key={i}>
                            <td>
                              <input type="checkbox" checked={selected.has(i)} onChange={() => toggleRow(i)} />
                            </td>
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
                              <select value={r.status} onChange={(e) => updateRow(i, { status: e.target.value })}>
                                <option value="available">ว่าง</option>
                                <option value="maintenance">ปิดปรับปรุง</option>
                              </select>
                            </td>
                            <td>
                              <button type="button" className="plain-icon-btn" onClick={() => removeRow(i)}>
                                <TrashIcon size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
        <div className="modal-footer">
          <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
            ทั้งหมด {rows.length} ห้อง ({floorGroups.length} ชั้น)
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="secondary" onClick={onClose}>
              ยกเลิก
            </button>
            <button type="button" onClick={handleSubmit} disabled={pending || rows.length === 0}>
              สร้างทั้งหมด ({rows.length} ห้อง)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
