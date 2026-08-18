"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { RepairRequestWithRelations, Room, Technician, RepairCategory, SharedEquipment } from "./types";
import RepairFormModal from "./RepairFormModal";
import RepairDetailModal from "./RepairDetailModal";
import RepairSettingsModal from "./RepairSettingsModal";
import AirconBatchModal from "./AirconBatchModal";
import { WrenchIcon, PlusIcon, SettingsIcon, SparklesIcon } from "../icons";

const STATUS_LABEL: Record<string, string> = { pending: "รอดำเนินการ", in_progress: "กำลังดำเนินการ", completed: "เสร็จสิ้น" };
const PRIORITY_LABEL: Record<string, string> = { low: "ต่ำ", medium: "ปานกลาง", high: "สูง", urgent: "เร่งด่วน" };

import { formatDateBE } from "@/lib/date-utils";

function fmtDate(d: Date | string) {
  return formatDateBE(d);
}

export default function RepairsClient({
  requests,
  categories,
  technicians,
  equipment,
  rooms,
  buildingName,
}: {
  requests: RepairRequestWithRelations[];
  categories: RepairCategory[];
  technicians: Technician[];
  equipment: SharedEquipment[];
  rooms: Room[];
  buildingName: string;
}) {
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState<"all" | "pending" | "in_progress" | "completed">("all");
  const [showForm, setShowForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAircon, setShowAircon] = useState(false);
  const [detailRequest, setDetailRequest] = useState<RepairRequestWithRelations | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  const counts = useMemo(
    () => ({
      pending: requests.filter((r) => r.status === "pending").length,
      in_progress: requests.filter((r) => r.status === "in_progress").length,
      completed: requests.filter((r) => r.status === "completed").length,
      urgent: requests.filter((r) => r.priority === "urgent").length,
    }),
    [requests]
  );

  const filtered = useMemo(() => (filter === "all" ? requests : requests.filter((r) => r.status === filter)), [requests, filter]);

  const defaultRoomId = searchParams.get("roomId") ? Number(searchParams.get("roomId")) : undefined;

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header-title">
            <WrenchIcon size={24} /> แจ้งซ่อม
          </div>
          <p className="page-header-subtitle">{buildingName}</p>
        </div>
        <div className="page-header-actions">
          <button className="secondary" onClick={() => setShowAircon(true)}>
            <SparklesIcon size={16} /> ล้างแอร์หลายห้อง
          </button>
          <button className="secondary" onClick={() => setShowSettings(true)}>
            <SettingsIcon size={16} /> ตั้งค่า
          </button>
          <button onClick={() => setShowForm(true)}>
            <PlusIcon size={16} /> แจ้งซ่อม
          </button>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">รอดำเนินการ</div>
          <div className="value">{counts.pending}</div>
        </div>
        <div className="stat-card">
          <div className="label">กำลังดำเนินการ</div>
          <div className="value">{counts.in_progress}</div>
        </div>
        <div className="stat-card">
          <div className="label">เสร็จสิ้น</div>
          <div className="value">{counts.completed}</div>
        </div>
        <div className="stat-card">
          <div className="label">เร่งด่วน</div>
          <div className="value" style={{ color: "var(--danger)" }}>
            {counts.urgent}
          </div>
        </div>
      </div>

      <div className="tabs">
        {(["all", "pending", "in_progress", "completed"] as const).map((f) => (
          <button key={f} className={`tab${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? "ทั้งหมด" : STATUS_LABEL[f]}
          </button>
        ))}
      </div>

      <table>
        <thead>
          <tr>
            <th></th>
            <th>หัวข้อ</th>
            <th>ห้อง</th>
            <th>ประเภท</th>
            <th>ความเร่งด่วน</th>
            <th>สถานะ</th>
            <th>ช่าง</th>
            <th>แจ้งเมื่อ</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((r) => (
            <tr key={r.id} style={{ cursor: "pointer", fontWeight: r.isRead ? "normal" : 700 }} onClick={() => setDetailRequest(r)}>
              <td>{!r.isRead && <span className="status-dot maintenance" />}</td>
              <td>{r.title}</td>
              <td>{r.room.roomNumber}</td>
              <td>{r.categoryName}</td>
              <td>
                <span className={`badge ${r.priority === "urgent" ? "danger" : "neutral"}`}>{PRIORITY_LABEL[r.priority]}</span>
              </td>
              <td>
                <span className={`badge ${r.status === "completed" ? "success" : r.status === "in_progress" ? "warning" : "neutral"}`}>
                  {STATUS_LABEL[r.status]}
                </span>
              </td>
              <td>{r.assignedTechnician?.name ?? "-"}</td>
              <td>{fmtDate(r.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && <p className="empty">ไม่พบรายการแจ้งซ่อม</p>}

      {showForm && (
        <RepairFormModal
          rooms={rooms}
          categories={categories}
          technicians={technicians}
          defaultRoomId={defaultRoomId}
          onClose={() => setShowForm(false)}
          onSaved={notify}
        />
      )}
      {showSettings && (
        <RepairSettingsModal categories={categories} technicians={technicians} equipment={equipment} onClose={() => setShowSettings(false)} />
      )}
      {showAircon && <AirconBatchModal rooms={rooms} technicians={technicians} onClose={() => setShowAircon(false)} onSaved={notify} />}
      {detailRequest && (
        <RepairDetailModal
          request={requests.find((r) => r.id === detailRequest.id) ?? detailRequest}
          technicians={technicians}
          onClose={() => setDetailRequest(null)}
          onChanged={notify}
        />
      )}
    </div>
  );
}
