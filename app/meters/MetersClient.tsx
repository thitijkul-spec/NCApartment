"use client";

import { useMemo, useState, useTransition } from "react";
import type { Room, RoomOccupancy, Tenant, MeterReading } from "@prisma/client";
import { updateMeterReading, importMetersCsv, bulkRecordMeterReadings } from "./actions";
import { GaugeIcon, XIcon } from "../icons";
import MonthNav from "../MonthNav";

type RoomWithOcc = Room & { occupancies: (RoomOccupancy & { tenant: Tenant })[] };

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

import { formatDateTimeBE } from "@/lib/date-utils";

function fmtDateTime(d: Date | string) {
  return formatDateTimeBE(d);
}

type EditCell = { water: string; electric: string };

export default function MetersClient({ rooms, readings, buildingName }: { rooms: RoomWithOcc[]; readings: MeterReading[]; buildingName: string }) {
  const [historyRoom, setHistoryRoom] = useState<RoomWithOcc | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<number, EditCell>>({});
  const [saving, startSaving] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveWarnings, setSaveWarnings] = useState<string[]>([]);
  const [month, setMonth] = useState(currentMonthKey());

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  function changeMonth(next: string) {
    setMonth(next);
    setEdits({});
    setSaveError(null);
    setSaveWarnings([]);
  }

  function setEdit(roomId: number, field: "water" | "electric", value: string) {
    setEdits((prev) => ({ ...prev, [roomId]: { ...prev[roomId], [field]: value } }));
  }

  // เรียงตาม readingMonth ใหม่→เก่าต่อห้อง (ไม่ใช่ recordedAt เพราะอาจกรอกย้อนหลังไม่เรียงตามเวลาจริง) — ใช้หาทั้ง "เดือนที่เลือก" และ "เดือนก่อนหน้าล่าสุด"
  const readingsByRoom = useMemo(() => {
    const map = new Map<number, MeterReading[]>();
    for (const r of readings) {
      if (!map.has(r.roomId)) map.set(r.roomId, []);
      map.get(r.roomId)!.push(r);
    }
    for (const list of map.values()) list.sort((a, b) => (a.readingMonth < b.readingMonth ? 1 : -1));
    return map;
  }, [readings]);

  function readingForMonth(roomId: number) {
    return readingsByRoom.get(roomId)?.find((r) => r.readingMonth === month) ?? null;
  }
  function prevReading(roomId: number) {
    return readingsByRoom.get(roomId)?.find((r) => r.readingMonth < month) ?? null;
  }

  const stats = useMemo(() => {
    let waterSum = 0;
    let electricSum = 0;
    let recorded = 0;
    for (const room of rooms) {
      const current = readingForMonth(room.id);
      if (current) {
        waterSum += current.waterUnits;
        electricSum += current.electricUnits;
        recorded++;
      }
    }
    return { waterSum, electricSum, recorded, total: rooms.length };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rooms, readingsByRoom, month]);

  const editedCount = Object.values(edits).filter((e) => e.water?.trim() || e.electric?.trim()).length;

  function handleBulkSave() {
    setSaveError(null);
    setSaveWarnings([]);
    const rows = Object.entries(edits)
      .map(([roomId, v]) => ({
        roomId: Number(roomId),
        waterCurrent: v.water?.trim() ? Number(v.water) : null,
        electricCurrent: v.electric?.trim() ? Number(v.electric) : null,
      }))
      .filter((r) => r.waterCurrent != null || r.electricCurrent != null);

    if (rows.length === 0) {
      setSaveError("กรุณากรอกเลขมิเตอร์อย่างน้อย 1 ห้องก่อนบันทึก");
      return;
    }

    const formData = new FormData();
    formData.set("rowsJson", JSON.stringify(rows));
    formData.set("month", month);
    startSaving(async () => {
      const result = await bulkRecordMeterReadings(formData);
      if (result?.error) {
        setSaveError(result.error);
      } else {
        setEdits({});
        setSaveWarnings(result.warnings ?? []);
        notify(`บันทึกมิเตอร์แล้ว ${result.saved} ห้อง`);
      }
    });
  }

  function exportCsv() {
    const header = "หมายเลขห้อง,ผู้เช่า,มิเตอร์น้ำครั้งล่าสุด,มิเตอร์น้ำปัจจุบัน,มิเตอร์ไฟครั้งล่าสุด,มิเตอร์ไฟปัจจุบัน";
    const lines = rooms.map((room) => {
      const latest = readingForMonth(room.id) ?? prevReading(room.id);
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
          <p className="page-header-subtitle">กรอกเลขมิเตอร์ของ {buildingName} (กรอกในตารางแล้วกดบันทึกทั้งหมดทีเดียว)</p>
        </div>
        <div className="page-header-actions">
          <button className="secondary" onClick={exportCsv}>
            Export ข้อมูลปัจจุบัน
          </button>
          <button className="secondary" onClick={() => setShowImport(true)}>
            Import
          </button>
          <button onClick={handleBulkSave} disabled={saving || editedCount === 0}>
            {saving ? "กำลังบันทึก..." : `บันทึกทั้งหมด${editedCount > 0 ? ` (${editedCount})` : ""}`}
          </button>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <MonthNav month={month} onChange={changeMonth} />
        {month !== currentMonthKey() && (
          <button type="button" className="secondary" onClick={() => changeMonth(currentMonthKey())}>
            กลับเดือนนี้
          </button>
        )}
      </div>

      {toast && <div className="toast">{toast}</div>}
      {saveError && <div className="form-error">{saveError}</div>}
      {saveWarnings.length > 0 && (
        <div className="form-error" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>
          <strong>บันทึกสำเร็จ แต่มีรายการที่ควรตรวจสอบ:</strong>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
            {saveWarnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">รวมหน่วยน้ำ (เดือน {month})</div>
          <div className="value">{stats.waterSum.toFixed(1)}</div>
        </div>
        <div className="stat-card">
          <div className="label">รวมหน่วยไฟ (เดือน {month})</div>
          <div className="value">{stats.electricSum.toFixed(1)}</div>
        </div>
        <div className="stat-card">
          <div className="label">บันทึกแล้ว</div>
          <div className="value">
            {stats.recorded}/{stats.total}
          </div>
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table className="bulk-table">
          <thead>
            <tr>
              <th>ห้อง</th>
              <th>ผู้เช่า</th>
              <th>น้ำก่อนหน้า</th>
              <th>น้ำปัจจุบัน</th>
              <th>หน่วยน้ำ</th>
              <th>ไฟก่อนหน้า</th>
              <th>ไฟปัจจุบัน</th>
              <th>หน่วยไฟ</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => (
              <MeterRow
                key={room.id}
                room={room}
                current={readingForMonth(room.id)}
                prev={prevReading(room.id)}
                edit={edits[room.id]}
                onChange={setEdit}
                onHistory={() => setHistoryRoom(room)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {historyRoom && (
        <MeterHistoryModal room={historyRoom} history={readingsByRoom.get(historyRoom.id) ?? []} onClose={() => setHistoryRoom(null)} onSaved={notify} />
      )}
      {showImport && <ImportModal month={month} onClose={() => setShowImport(false)} onSaved={notify} />}
    </div>
  );
}

function MeterRow({
  room,
  current,
  prev,
  edit,
  onChange,
  onHistory,
}: {
  room: RoomWithOcc;
  current: MeterReading | null;
  prev: MeterReading | null;
  edit: EditCell | undefined;
  onChange: (roomId: number, field: "water" | "electric", value: string) => void;
  onHistory: () => void;
}) {
  const recordedThisMonth = !!current;
  const billed = recordedThisMonth && current!.billingStatus === "billed";

  const waterPrev = recordedThisMonth ? current!.waterPrev : prev?.waterCurrent ?? 0;
  const electricPrev = recordedThisMonth ? current!.electricPrev : prev?.electricCurrent ?? 0;
  const defaultWater = recordedThisMonth ? String(current!.waterCurrent) : "";
  const defaultElectric = recordedThisMonth ? String(current!.electricCurrent) : "";

  const waterValue = edit?.water ?? defaultWater;
  const electricValue = edit?.electric ?? defaultElectric;

  const waterUnits = waterValue.trim() ? Number(waterValue) - waterPrev : null;
  const electricUnits = electricValue.trim() ? Number(electricValue) - electricPrev : null;

  return (
    <tr>
      <td>{room.roomNumber}</td>
      <td>{room.occupancies[0]?.tenant.name ?? "-"}</td>
      <td>{waterPrev}</td>
      <td>
        {billed ? (
          current!.waterCurrent
        ) : (
          <input
            type="number"
            step="0.01"
            value={waterValue}
            onChange={(e) => onChange(room.id, "water", e.target.value)}
            style={{ width: 90 }}
          />
        )}
      </td>
      <td style={{ color: waterUnits != null && waterUnits < 0 ? "var(--danger)" : undefined }}>
        {waterUnits != null ? waterUnits.toFixed(1) : "-"}
      </td>
      <td>{electricPrev}</td>
      <td>
        {billed ? (
          current!.electricCurrent
        ) : (
          <input
            type="number"
            step="0.01"
            value={electricValue}
            onChange={(e) => onChange(room.id, "electric", e.target.value)}
            style={{ width: 90 }}
          />
        )}
      </td>
      <td style={{ color: electricUnits != null && electricUnits < 0 ? "var(--danger)" : undefined }}>
        {electricUnits != null ? electricUnits.toFixed(1) : "-"}
      </td>
      <td>
        {billed ? (
          <span className="badge success">ออกบิลแล้ว</span>
        ) : recordedThisMonth ? (
          <span className="badge success">บันทึกแล้ว</span>
        ) : (
          <span className="badge neutral">ยังไม่บันทึก</span>
        )}
      </td>
      <td>
        <button type="button" className="plain-icon-btn" title="ประวัติ" onClick={onHistory}>
          🕑
        </button>
      </td>
    </tr>
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
  const [error, setError] = useState<string | null>(null);

  function saveEdit(id: number, waterCurrent: string, electricCurrent: string) {
    setError(null);
    const formData = new FormData();
    formData.set("readingId", String(id));
    formData.set("waterCurrent", waterCurrent);
    formData.set("electricCurrent", electricCurrent);
    startTransition(async () => {
      const result = await updateMeterReading(formData);
      if (result?.error) setError(result.error);
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
          {error && <div className="form-error">{error}</div>}
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

function ImportModal({ month, onClose, onSaved }: { month: string; onClose: () => void; onSaved: (msg: string) => void }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ imported: number; skipped: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("month", month);
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
            <br />
            จะนำเข้าเป็นข้อมูลของเดือน <strong>{month}</strong>
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
