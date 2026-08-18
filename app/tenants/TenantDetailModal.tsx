"use client";

import { useTransition } from "react";
import type { TenantWithRelations } from "./types";
import { archiveTenant, deleteTenant } from "./actions";
import { XIcon, PersonIcon, DoorIcon } from "../icons";

import { formatDateBE } from "@/lib/date-utils";
import { formatNumber } from "@/lib/format";

function fmtDate(d: Date | string | null | undefined) {
  return formatDateBE(d);
}

export default function TenantDetailModal({
  tenant,
  onClose,
  onChanged,
  onEdit,
}: {
  tenant: TenantWithRelations;
  onClose: () => void;
  onChanged: (msg: string) => void;
  onEdit: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const activeOccupancies = tenant.occupancies.filter((o) => o.status === "active");
  const pastOccupancies = tenant.occupancies.filter((o) => o.status === "moved_out");

  function handleArchive() {
    const formData = new FormData();
    formData.set("tenantId", String(tenant.id));
    startTransition(async () => {
      const result = await archiveTenant(formData);
      if (result?.error) alert(result.error);
      else {
        onChanged("เก็บเข้าคลังแล้ว");
        onClose();
      }
    });
  }

  function handleDelete() {
    if (!confirm(`ยืนยันลบผู้เช่า "${tenant.name}"?`)) return;
    const formData = new FormData();
    formData.set("tenantId", String(tenant.id));
    startTransition(async () => {
      const result = await deleteTenant(formData);
      if (result?.error) alert(result.error);
      else {
        onChanged("ลบผู้เช่าแล้ว");
        onClose();
      }
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <PersonIcon size={18} /> {tenant.name}
          </h2>
          <button className="modal-close" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        <div className="modal-body">
          {activeOccupancies.map((o) => {
            const overdue = o.plannedCheckoutDate && new Date(o.plannedCheckoutDate).getTime() < Date.now();
            return (
              <div key={o.id} className="card" style={{ marginBottom: 12, background: overdue ? "var(--danger-soft)" : undefined }}>
                {overdue && <strong style={{ color: "var(--danger)" }}>⚠ หมดเวลาพักแล้ว</strong>}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: overdue ? 6 : 0 }}>
                  <DoorIcon size={16} />
                  <a href={`/rooms`}>ห้อง {o.room.roomNumber}</a>
                  <span style={{ color: "var(--text-muted)", fontSize: 13 }}>ชั้น {o.room.floor}</span>
                </div>
                <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  เข้าพัก {fmtDate(o.checkinDate)} · วันออก(วางแผน) {fmtDate(o.plannedCheckoutDate)} · มัดจำ ฿{formatNumber(o.depositAmount ?? 0)}
                </p>
              </div>
            );
          })}
          {activeOccupancies.length === 0 && <p className="empty">ไม่มีห้องที่เข้าพักอยู่ในขณะนี้</p>}

          <table>
            <tbody>
              <tr>
                <td>เบอร์โทร</td>
                <td>{tenant.phone ?? "-"}</td>
              </tr>
              <tr>
                <td>LINE ID</td>
                <td>{tenant.lineId ?? "-"}</td>
              </tr>
              <tr>
                <td>LINE เชื่อมต่อ</td>
                <td>{tenant.lineUserId ? <span className="badge success">เชื่อมต่อแล้ว</span> : <span className="badge neutral">ยังไม่เชื่อม</span>}</td>
              </tr>
              <tr>
                <td>เลขบัตรประชาชน</td>
                <td>{tenant.idCardNo ?? "-"}</td>
              </tr>
              <tr>
                <td>ยานพาหนะ</td>
                <td>
                  {tenant.vehicles.length === 0
                    ? "-"
                    : tenant.vehicles.map((v) => `${v.plateNo} ${v.brandModel} ${v.color}`).join(", ")}
                </td>
              </tr>
            </tbody>
          </table>

          {tenant.tenantType === "monthly" && (
            <>
              <h2 style={{ fontSize: 15, marginTop: 16 }}>เอกสารสัญญา</h2>
              {tenant.contracts.length === 0 && <p className="empty">ยังไม่มีสัญญา</p>}
              {tenant.contracts.map((c) => (
                <a key={c.id} href={`/contracts/${c.id}`} className="secondary btn" style={{ marginRight: 8, marginBottom: 8 }}>
                  สัญญา #{c.id} ({fmtDate(c.startDate)})
                </a>
              ))}
            </>
          )}

          {pastOccupancies.length > 0 && (
            <>
              <h2 style={{ fontSize: 15, marginTop: 16 }}>ประวัติห้องที่เคยพัก</h2>
              <table>
                <thead>
                  <tr>
                    <th>ห้อง</th>
                    <th>เข้าพัก</th>
                    <th>ย้ายออก</th>
                    <th>เหตุผล</th>
                  </tr>
                </thead>
                <tbody>
                  {pastOccupancies.map((o) => (
                    <tr key={o.id}>
                      <td>{o.room.roomNumber}</td>
                      <td>{fmtDate(o.checkinDate)}</td>
                      <td>{fmtDate(o.movedOutDate)}</td>
                      <td>{o.movedOutReason ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {tenant.note && (
            <>
              <h2 style={{ fontSize: 15, marginTop: 16 }}>หมายเหตุ</h2>
              <p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{tenant.note}</p>
            </>
          )}
        </div>
        <div className="modal-footer">
          <div style={{ display: "flex", gap: 8 }}>
            <button className="secondary" onClick={handleArchive} disabled={pending}>
              เก็บเข้าคลัง
            </button>
            <button className="danger" onClick={handleDelete} disabled={pending}>
              ลบ
            </button>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <a href="/rooms" className="secondary btn">
              ย้ายห้อง/ย้ายออก (ที่หน้าห้อง)
            </a>
            <button onClick={onEdit}>แก้ไขข้อมูล</button>
          </div>
        </div>
      </div>
    </div>
  );
}
