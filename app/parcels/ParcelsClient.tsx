"use client";

import { useMemo, useState, useTransition } from "react";
import type { Tenant } from "@prisma/client";
import type { ParcelWithRelations } from "./types";
import { STATUS_LABEL, STATUS_BADGE, isOverdue } from "./types";
import ParcelFormModal from "./ParcelFormModal";
import { deleteParcel, advanceParcelStatus, setParcelStatus, notifyParcel } from "./actions";
import { formatDateTimeBE } from "@/lib/date-utils";
import { PackageIcon, PlusIcon } from "../icons";

type FilterTab = "all" | "arrived" | "notified" | "picked_up" | "overdue";

export default function ParcelsClient({
  parcels,
  tenants,
  overdueDays,
  buildingName,
}: {
  parcels: ParcelWithRelations[];
  tenants: Tenant[];
  overdueDays: number;
  buildingName: string;
}) {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<ParcelWithRelations | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4500);
  }

  const stats = {
    all: parcels.length,
    arrived: parcels.filter((p) => p.status === "arrived").length,
    notified: parcels.filter((p) => p.status === "notified").length,
    overdue: parcels.filter((p) => isOverdue(p, overdueDays)).length,
  };

  const filtered = useMemo(() => {
    return parcels.filter((p) => {
      if (filter === "overdue" && !isOverdue(p, overdueDays)) return false;
      if (filter !== "all" && filter !== "overdue" && p.status !== filter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matches =
          p.recipientName.toLowerCase().includes(q) ||
          (p.tenant?.name ?? "").toLowerCase().includes(q) ||
          (p.room?.roomNumber ?? "").toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });
  }, [parcels, filter, search, overdueDays]);

  function handleDelete(id: number) {
    if (!confirm("ยืนยันลบพัสดุนี้ถาวร?")) return;
    const formData = new FormData();
    formData.set("parcelId", String(id));
    startTransition(async () => {
      await deleteParcel(formData);
      notify("ลบแล้ว");
    });
  }

  function handleAdvance(id: number) {
    const formData = new FormData();
    formData.set("parcelId", String(id));
    startTransition(async () => {
      await advanceParcelStatus(formData);
      notify("เปลี่ยนสถานะแล้ว");
    });
  }

  function handleSetStatus(id: number, status: string, currentStatus: string) {
    if (status === currentStatus) return;
    const statusOrder = ["arrived", "notified", "picked_up"];
    const isBackward = statusOrder.indexOf(status) < statusOrder.indexOf(currentStatus);
    if (isBackward && !confirm(`ยืนยันเปลี่ยนสถานะย้อนกลับเป็น "${STATUS_LABEL[status]}"?`)) return;
    const formData = new FormData();
    formData.set("parcelId", String(id));
    formData.set("status", status);
    startTransition(async () => {
      await setParcelStatus(formData);
      notify("เปลี่ยนสถานะแล้ว");
    });
  }

  function handleNotify(id: number) {
    const formData = new FormData();
    formData.set("parcelId", String(id));
    startTransition(async () => {
      const result = await notifyParcel(formData);
      if (result?.error) notify(result.error);
      else notify(`แจ้งเตือนแล้ว — ข้อความ: "${result?.message}"`);
    });
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header-title">
            <PackageIcon size={24} /> พัสดุ
          </div>
          <p className="page-header-subtitle">จัดการพัสดุที่มาส่งของ {buildingName}</p>
        </div>
        <div className="page-header-actions">
          <button onClick={() => setShowAdd(true)}>
            <PlusIcon size={16} /> บันทึกพัสดุ
          </button>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 16 }}>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>ทั้งหมด</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.all}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>พัสดุเข้า</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.arrived}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>แจ้งแล้ว</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.notified}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>ตกค้าง</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: stats.overdue > 0 ? "var(--danger)" : undefined }}>{stats.overdue}</div>
        </div>
      </div>

      <input placeholder="ค้นหาเลขห้อง, ชื่อผู้เช่า, ชื่อผู้รับ..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 12, minWidth: 280 }} />

      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={`tab${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")}>
          ทั้งหมด
        </button>
        <button className={`tab${filter === "arrived" ? " active" : ""}`} onClick={() => setFilter("arrived")}>
          พัสดุเข้า
        </button>
        <button className={`tab${filter === "notified" ? " active" : ""}`} onClick={() => setFilter("notified")}>
          แจ้งลูกบ้านแล้ว
        </button>
        <button className={`tab${filter === "picked_up" ? " active" : ""}`} onClick={() => setFilter("picked_up")}>
          รับพัสดุแล้ว
        </button>
        <button className={`tab${filter === "overdue" ? " active" : ""}`} onClick={() => setFilter("overdue")}>
          ตกค้าง
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
        {filtered.map((p) => {
          const overdue = isOverdue(p, overdueDays);
          return (
            <div key={p.id} className="card" style={{ marginBottom: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <strong>{p.recipientName}</strong>
                  {p.tenant && (
                    <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      {p.tenant.name} · ห้อง {p.room?.roomNumber ?? "-"}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 4, flexDirection: "column", alignItems: "flex-end" }}>
                  <span className={`badge ${STATUS_BADGE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                  {overdue && <span className="badge danger">ตกค้าง</span>}
                </div>
              </div>
              <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "8px 0" }}>
                {p.deliveryCompany ?? "-"} {p.trackingNo && `· ${p.trackingNo}`}
                <br />
                มาส่ง {formatDateTimeBE(p.receivedAt)}
              </p>
              {p.notes && <p style={{ fontSize: 13 }}>{p.notes}</p>}

              <div className="field" style={{ marginTop: 8 }}>
                <select value={p.status} onChange={(e) => handleSetStatus(p.id, e.target.value, p.status)} style={{ fontSize: 13 }}>
                  <option value="arrived">พัสดุเข้า</option>
                  <option value="notified">แจ้งลูกบ้านแล้ว</option>
                  <option value="picked_up">รับพัสดุแล้ว</option>
                </select>
              </div>

              <div className="status-buttons" style={{ marginTop: 8, flexWrap: "wrap" }}>
                {p.status !== "picked_up" && (
                  <button className="secondary" disabled={pending} onClick={() => handleAdvance(p.id)}>
                    ✓ ขั้นถัดไป
                  </button>
                )}
                <button className="secondary" disabled={pending || !p.tenant?.lineUserId} onClick={() => handleNotify(p.id)} title={!p.tenant?.lineUserId ? "ยังไม่ได้โยงผู้เช่าที่ผูก LINE" : ""}>
                  🔔 แจ้งเตือน LINE
                </button>
                {p.photoUrl && (
                  <a className="secondary btn" href={p.photoUrl} target="_blank" rel="noreferrer">
                    🖼️ ดูรูป
                  </a>
                )}
                <button className="secondary" onClick={() => setEditing(p)}>
                  แก้ไข
                </button>
                <button className="danger" onClick={() => handleDelete(p.id)}>
                  ลบ
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {filtered.length === 0 && <p className="empty">ยังไม่มีพัสดุตามเงื่อนไขนี้</p>}

      {showAdd && <ParcelFormModal parcel={null} tenants={tenants} onClose={() => setShowAdd(false)} onSaved={notify} />}
      {editing && <ParcelFormModal parcel={editing} tenants={tenants} onClose={() => setEditing(null)} onSaved={notify} />}
    </div>
  );
}
