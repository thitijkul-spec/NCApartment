"use client";

import { useMemo, useState, useTransition } from "react";
import type { Room, RoomOccupancy, Tenant, MeterReading } from "@prisma/client";
import { recordMeterReading, updateMeterReading, importMetersCsv } from "./actions";
import { GaugeIcon, XIcon } from "../icons";

type RoomWithOcc = Room & { occupancies: (RoomOccupancy & { tenant: Tenant })[] };

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fmtDateTime(d: Date | string) {
  return new Date(d).toLocaleString("th-TH", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function MetersClient({ rooms, readings, buildingName }: { rooms: RoomWithOcc[]; readings: MeterReading[]; buildingName: string }) {
  const [entryRoom, setEntryRoom] = useState<RoomWithOcc | null>(null);
  const [historyRoom, setHistoryRoom] = useState<RoomWithOcc | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  const readingsByRoom = useMemo(() => {
    const map = new Map<number, MeterReading[]>();
    for (const r of readings) {
      if (!map.has(r.roomId)) map.set(r.roomId, []);
      map.get(r.roomId)!.push(r);
    }
    return map;
  }, [readings]);

  const month = currentMonthKey();
  const stats = useMemo(() => {
    let waterSum = 0;
    let electricSum = 0;
    let recorded = 0;
    for (const room of rooms) {
      const latest = readingsByRoom.get(room.id)?.[0];
      if (latest && latest.readingMonth === month) {
        waterSum += latest.waterUnits;
        electricSum += latest.electricUnits;
        recorded++;
      }
    }
    return { waterSum, electricSum, recorded, total: rooms.length };
  }, [rooms, readingsByRoom, month]);

  function exportCsv() {
    const header = "หมายเลขห้อง,ผู้เช่า,มิเตอร์น้ำครั้งล่าสุด,มิเตอร์น้ำปัจจุบัน,มิเตอร์ไฟครั้งล่าสุด,มิเตอร์ไฟปัจจุบัน";
    const lines = rooms.map((room) => {
      const latest = readingsByRoom.get(room.id)?.[0];
      const tenant = room.occupancies[0]?.tenant.name ?? "";
      return `${room.roomNumber},${tenant},${latest?.waterCurrent ?? 0},,${latest?.electricCurrent ?? 0},`;
    });
    const csv = [header, ...lines].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meters-${buildingName}-${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header-title">
            <GaugeIcon size={24} /> มิเตอร์น้ำ-ไฟ
          </div>
          <p className="page-header-subtitle">บันทึกเลขมิเตอร์ของ {buildingName} — เดือน {month}</p>
        </div>
        <div className="page-header-actions">
          <button className="secondary" onClick={exportCsv}>
            Export ข้อมูลปัจจุบัน
          </button>
          <button className="secondary" onClick={() => setShowImport(true)}>
            Import
          </button>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">รวมหน่วยน้ำ (เดือนนี้)</div>
          <div className="value">{stats.waterSum.toFixed(1)}</div>
        </div>
        <div className="stat-card">
          <div className="label">รวมหน่วยไฟ (เดือนนี้)</div>
          <div className="value">{stats.electricSum.toFixed(1)}</div>
        </div>
        <div className="stat-card">
          <div className="label">บันทึกแล้ว</div>
          <div className="value">
            {stats.recorded}/{stats.total}
          </div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>ห้อง</th>
            <th>ผู้เช่า</th>
            <th>น้ำ (ก่อน→ใหม่)</th>
            <th>ไฟ (ก่อน→ใหม่)</th>
            <th>จัดการ</th>
          </tr>
        </thead>
        <tbody>
          {rooms.map((room) => {
            const latest = readingsByRoom.get(room.id)?.[0];
            const recordedThisMonth = latest?.readingMonth === month;
            return (
              <tr key={room.id}>
                <td>{room.roomNumber}</td>
                <td>{room.occupancies[0]?.tenant.name ?? "-"}</td>
                <td>
                  {latest ? `${latest.waterPrev} → ${latest.waterCurrent}` : "-"}
                </td>
                <td>{latest ? `${latest.electricPrev} → ${latest.electricCurrent}` : "-"}</td>
                <td>
                  <div className="status-buttons">
                    {recordedThisMonth ? (
                      <span className="badge success">บันทึกแล้ว</span>
                    ) : (
                      <button className="secondary" onClick={() => setEntryRoom(room)}>
                        + ยังไม่มีการบันทึก
                      </button>
                    )}
                    <button className="plain-icon-btn" title="ประวัติ" onClick={() => setHistoryRoom(room)}>
                      🕑
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {entryRoom && (
        <MeterEntryModal
          room={entryRoom}
          lastReading={readingsByRoom.get(entryRoom.id)?.[0] ?? null}
          onClose={() => setEntryRoom(null)}
          onSaved={notify}
        />
      )}
      {historyRoom && (
        <MeterHistoryModal room={historyRoom} history={readingsByRoom.get(historyRoom.id) ?? []} onClose={() => setHistoryRoom(null)} onSaved={notify} />
      )}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onSaved={notify} />}
    </div>
  );
}

function MeterEntryModal({
  room,
  lastReading,
  onClose,
  onSaved,
}: {
  room: RoomWithOcc;
  lastReading: MeterReading | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [waterCurrent, setWaterCurrent] = useState("");
  const [electricCurrent, setElectricCurrent] = useState("");

  function submit(confirmAnyway: boolean) {
    setError(null);
    const formData = new FormData();
    formData.set("roomId", String(room.id));
    formData.set("waterCurrent", waterCurrent || "0");
    formData.set("electricCurrent", electricCurrent || "0");
    if (confirmAnyway) formData.set("confirmAnyway", "on");

    startTransition(async () => {
      const result = await recordMeterReading(formData);
      if (result?.warning) setWarning(result.warning);
      else if (result?.error) setError(result.error);
      else {
        onSaved("บันทึกมิเตอร์แล้ว");
        onClose();
      }
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            บันทึกมิเตอร์ — ห้อง {room.roomNumber} {room.occupancies[0] && `(${room.occupancies[0].tenant.name})`}
          </h2>
          <button className="modal-close" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}
          {warning && (
            <div className="form-error" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>
              {warning}
              <div style={{ marginTop: 8 }}>
                <button type="button" onClick={() => { setWarning(null); submit(true); }} style={{ marginRight: 8 }}>
                  ยืนยันบันทึกต่อ
                </button>
                <button type="button" className="secondary" onClick={() => setWarning(null)}>
                  แก้ไขค่า
                </button>
              </div>
            </div>
          )}
          <div className="bulk-preview-note">
            ค่ามิเตอร์ครั้งก่อน — น้ำ: {lastReading?.waterCurrent ?? 0} · ไฟ: {lastReading?.electricCurrent ?? 0}
          </div>
          <div className="form-row">
            <div className="field">
              <label>น้ำปัจจุบัน</label>
              <input type="number" step="0.01" value={waterCurrent} onChange={(e) => setWaterCurrent(e.target.value)} />
            </div>
            <div className="field">
              <label>ไฟปัจจุบัน</label>
              <input type="number" step="0.01" value={electricCurrent} onChange={(e) => setElectricCurrent(e.target.value)} />
            </div>
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="secondary" onClick={onClose}>
            ยกเลิก
          </button>
          <button type="button" onClick={() => submit(false)} disabled={pending}>
            {pending ? "กำลังบันทึก..." : "บันทึก"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MeterHistoryModal({
  room,
  history,
  onClose,
  onSaved,
}: {
  room: RoomWithOcc;
  history: MeterReading[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();

  function saveEdit(id: number, waterCurrent: string, electricCurrent: string) {
    const formData = new FormData();
    formData.set("readingId", String(id));
    formData.set("waterCurrent", waterCurrent);
    formData.set("electricCurrent", electricCurrent);
    startTransition(async () => {
      const result = await updateMeterReading(formData);
      if (result?.error) alert(result.error);
      else {
        onSaved("แก้ไขแล้ว");
        setEditingId(null);
      }
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>ประวัติมิเตอร์ — ห้อง {room.roomNumber}</h2>
          <button className="modal-close" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        <div className="modal-body">
          <table>
            <thead>
              <tr>
                <th>เดือน</th>
                <th>น้ำ (ก่อน→ใหม่)</th>
                <th>ไฟ (ก่อน→ใหม่)</th>
                <th>บันทึกเมื่อ</th>
                <th>สถานะ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {history.map((h) =>
                editingId === h.id ? (
                  <EditRow key={h.id} reading={h} onCancel={() => setEditingId(null)} onSave={saveEdit} pending={pending} />
                ) : (
                  <tr key={h.id}>
                    <td>{h.readingMonth}</td>
                    <td>
                      {h.waterPrev} → {h.waterCurrent} ({h.waterUnits})
                    </td>
                    <td>
                      {h.electricPrev} → {h.electricCurrent} ({h.electricUnits})
                    </td>
                    <td>{fmtDateTime(h.recordedAt)}</td>
                    <td>
                      <span className={`badge ${h.billingStatus === "billed" ? "success" : "neutral"}`}>
                        {h.billingStatus === "billed" ? "ออกบิลแล้ว" : "ยังไม่ออกบิล"}
                      </span>
                    </td>
                    <td>
                      {h.billingStatus === "unbilled" && (
                        <button className="secondary" onClick={() => setEditingId(h.id)}>
                          แก้ไข
                        </button>
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
          {history.length === 0 && <p className="empty">ยังไม่มีประวัติ</p>}
        </div>
      </div>
    </div>
  );
}

function EditRow({
  reading,
  onCancel,
  onSave,
  pending,
}: {
  reading: MeterReading;
  onCancel: () => void;
  onSave: (id: number, water: string, electric: string) => void;
  pending: boolean;
}) {
  const [water, setWater] = useState(String(reading.waterCurrent));
  const [electric, setElectric] = useState(String(reading.electricCurrent));
  return (
    <tr>
      <td>{reading.readingMonth}</td>
      <td>
        {reading.waterPrev} → <input type="number" value={water} onChange={(e) => setWater(e.target.value)} style={{ width: 70 }} />
      </td>
      <td>
        {reading.electricPrev} → <input type="number" value={electric} onChange={(e) => setElectric(e.target.value)} style={{ width: 70 }} />
      </td>
      <td colSpan={2}></td>
      <td>
        <button onClick={() => onSave(reading.id, water, electric)} disabled={pending}>
          บันทึก
        </button>
        <button className="secondary" onClick={onCancel}>
          ยกเลิก
        </button>
      </td>
    </tr>
  );
}

function ImportModal({ onClose, onSaved }: { onClose: () => void; onSaved: (msg: string) => void }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ imported: number; skipped: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await importMetersCsv(formData);
      if (res?.error) setError(res.error);
      else if (res?.success) {
        setResult({ imported: res.imported, skipped: res.skipped });
        onSaved(`นำเข้า ${res.imported} รายการแล้ว`);
      }
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Import มิเตอร์จาก CSV</h2>
          <button className="modal-close" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            ใช้โครงคอลัมน์เดียวกับไฟล์ที่ Export ออกไป: หมายเลขห้อง, ผู้เช่า, มิเตอร์น้ำครั้งล่าสุด, มิเตอร์น้ำปัจจุบัน, มิเตอร์ไฟครั้งล่าสุด, มิเตอร์ไฟปัจจุบัน
          </p>
          <form action={handleSubmit}>
            <input name="file" type="file" accept=".csv" required />
            <div style={{ marginTop: 16 }}>
              <button type="submit" disabled={pending}>
                {pending ? "กำลังนำเข้า..." : "นำเข้า"}
              </button>
            </div>
          </form>
          {result && (
            <div style={{ marginTop: 16 }}>
              <p className="badge success">นำเข้าสำเร็จ {result.imported} รายการ</p>
              {result.skipped.length > 0 && (
                <ul style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  {result.skipped.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
