"use client";

import { useEffect, useState, useTransition } from "react";
import type { RepairRequestWithRelations, Technician } from "./types";
import { updateRepairStatus, assignTechnician, deleteRepairRequest, markRepairRead } from "./actions";
import { XIcon, TrashIcon } from "../icons";

const STATUS_LABEL: Record<string, string> = { pending: "รอดำเนินการ", in_progress: "กำลังดำเนินการ", completed: "เสร็จสิ้น" };
const PRIORITY_LABEL: Record<string, string> = { low: "ต่ำ", medium: "ปานกลาง", high: "สูง", urgent: "เร่งด่วน" };

import { formatDateTimeBE } from "@/lib/date-utils";

function fmtDateTime(d: Date | string) {
  return formatDateTimeBE(d);
}

export default function RepairDetailModal({
  request,
  technicians,
  onClose,
  onChanged,
}: {
  request: RepairRequestWithRelations;
  technicians: Technician[];
  onClose: () => void;
  onChanged: (msg: string) => void;
}) {
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!request.isRead) {
      markRepairRead(request.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.id]);

  function changeStatus(status: string) {
    if (status === request.status) return;
    if (request.status === "completed" && status !== "completed") {
      if (!confirm("ยืนยันเปลี่ยนสถานะกลับจาก \"เสร็จสิ้น\"?")) return;
    }
    const formData = new FormData();
    formData.set("requestId", String(request.id));
    formData.set("status", status);
    startTransition(async () => {
      await updateRepairStatus(formData);
      onChanged("อัปเดตสถานะแล้ว");
    });
  }

  function changeTechnician(technicianId: string) {
    const formData = new FormData();
    formData.set("requestId", String(request.id));
    if (technicianId) formData.set("technicianId", technicianId);
    startTransition(async () => {
      await assignTechnician(formData);
      onChanged("มอบหมายช่างแล้ว");
    });
  }

  function handleDelete() {
    if (!confirm("ยืนยันลบรายการแจ้งซ่อมนี้ถาวร?")) return;
    const formData = new FormData();
    formData.set("requestId", String(request.id));
    startTransition(async () => {
      await deleteRepairRequest(formData);
      onChanged("ลบแล้ว");
      onClose();
    });
  }

  const photos: string[] = request.photos ? JSON.parse(request.photos) : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{request.title}</h2>
          <button className="modal-close" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        <div className="modal-body">
          <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
            ห้อง {request.room.roomNumber} · {request.categoryName} ·{" "}
            <span className={`badge ${request.priority === "urgent" ? "danger" : "neutral"}`}>{PRIORITY_LABEL[request.priority]}</span>
          </p>
          {request.description && <p style={{ fontSize: 14 }}>{request.description}</p>}
          {request.tenant && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>ผู้แจ้ง: {request.tenant.name}</p>}
          <p style={{ fontSize: 12, color: "var(--text-muted)" }}>แจ้งเมื่อ {fmtDateTime(request.createdAt)}</p>

          {photos.length > 0 && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
              {photos.map((url, i) => (
                <img key={i} src={url} alt="" style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 8 }} />
              ))}
            </div>
          )}

          <div className="field" style={{ marginTop: 16 }}>
            <label>สถานะ</label>
            <div className="status-buttons">
              {(["pending", "in_progress", "completed"] as const).map((s) => (
                <button key={s} className={request.status === s ? "" : "secondary"} onClick={() => changeStatus(s)} disabled={pending}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div className="field">
            <label>ช่างผู้รับผิดชอบ</label>
            <select defaultValue={request.assignedTechnicianId ?? ""} onChange={(e) => changeTechnician(e.target.value)} disabled={pending}>
              <option value="">-- ยังไม่มอบหมาย --</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="danger" onClick={handleDelete} disabled={pending}>
            <TrashIcon size={16} /> ลบ
          </button>
          <button className="secondary" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
