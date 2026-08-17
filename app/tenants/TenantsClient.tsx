"use client";

import { useMemo, useState } from "react";
import type { TenantWithRelations } from "./types";
import TenantFormModal from "./TenantFormModal";
import TenantDetailModal from "./TenantDetailModal";
import ImportModal from "./ImportModal";
import { restoreTenant } from "./actions";
import { PersonIcon, PlusIcon } from "../icons";

type StatusFilter = "current" | "moved_out" | "near_expiry";

function isNearExpiry(t: TenantWithRelations) {
  return t.occupancies.some((o) => {
    if (o.status !== "active" || !o.plannedCheckoutDate) return false;
    const days = (new Date(o.plannedCheckoutDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 30;
  });
}

export default function TenantsClient({ tenants, buildingName }: { tenants: TenantWithRelations[]; buildingName: string }) {
  const [search, setSearch] = useState("");
  const [statusFilters, setStatusFilters] = useState<Set<StatusFilter>>(new Set());
  const [typeFilter, setTypeFilter] = useState<"all" | "daily" | "monthly">("all");
  const [showArchived, setShowArchived] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editingTenant, setEditingTenant] = useState<TenantWithRelations | null>(null);
  const [detailTenant, setDetailTenant] = useState<TenantWithRelations | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  function toggleStatus(s: StatusFilter) {
    setStatusFilters((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  const filtered = useMemo(() => {
    return tenants.filter((t) => {
      if (showArchived) {
        if (!t.archivedAt) return false;
      } else {
        if (t.archivedAt) return false;
      }
      if (typeFilter !== "all" && t.tenantType !== typeFilter) return false;
      if (statusFilters.size > 0) {
        const hasCurrent = t.occupancies.some((o) => o.status === "active");
        const hasMovedOut = t.occupancies.some((o) => o.status === "moved_out");
        const nearExpiry = isNearExpiry(t);
        const matches =
          (statusFilters.has("current") && hasCurrent) ||
          (statusFilters.has("moved_out") && hasMovedOut) ||
          (statusFilters.has("near_expiry") && nearExpiry);
        if (!matches) return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const roomMatch = t.occupancies.some((o) => o.room.roomNumber.toLowerCase().includes(q));
        if (!t.name.toLowerCase().includes(q) && !(t.phone ?? "").includes(q) && !roomMatch) return false;
      }
      return true;
    });
  }, [tenants, search, statusFilters, typeFilter, showArchived]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header-title">
            <PersonIcon size={24} /> ผู้เช่า
          </div>
          <p className="page-header-subtitle">รายชื่อผู้เช่าทั้งหมดของ {buildingName}</p>
        </div>
        <div className="page-header-actions">
          <button className="secondary" onClick={() => setShowArchived((s) => !s)}>
            {showArchived ? "ดูรายการปกติ" : "คลังผู้เช่าที่เก็บไว้"}
          </button>
          {!showArchived && (
            <>
              <button className="secondary" onClick={() => setShowImport(true)}>
                นำเข้าไฟล์
              </button>
              <button onClick={() => setShowAdd(true)}>
                <PlusIcon size={16} /> เพิ่มผู้เช่า
              </button>
            </>
          )}
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {!showArchived && (
        <>
          <div className="form-row" style={{ marginBottom: 12 }}>
            <input placeholder="ค้นหาชื่อ, เบอร์โทร, เลขห้อง..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 260 }} />
            <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as any)}>
              <option value="all">ทุกประเภท</option>
              <option value="monthly">รายเดือน</option>
              <option value="daily">รายวัน</option>
            </select>
          </div>
          <div className="tabs">
            <button className={`tab${statusFilters.has("current") ? " active" : ""}`} onClick={() => toggleStatus("current")}>
              ผู้เช่าปัจจุบัน
            </button>
            <button className={`tab${statusFilters.has("moved_out") ? " active" : ""}`} onClick={() => toggleStatus("moved_out")}>
              ย้ายออกแล้ว
            </button>
            <button className={`tab${statusFilters.has("near_expiry") ? " active" : ""}`} onClick={() => toggleStatus("near_expiry")}>
              ใกล้หมดสัญญา
            </button>
          </div>
        </>
      )}

      <table>
        <thead>
          <tr>
            <th>ชื่อ-นามสกุล</th>
            <th>บัตร</th>
            <th>เบอร์โทร</th>
            <th>ห้อง</th>
            <th>LINE</th>
            <th>การดำเนินการ</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((t) => {
            const activeRooms = t.occupancies.filter((o) => o.status === "active");
            return (
              <tr key={t.id} style={{ cursor: "pointer" }} onClick={() => setDetailTenant(t)}>
                <td>{t.name}</td>
                <td>{t.idCardImageUrl ? "มี" : "-"}</td>
                <td>{t.phone ?? "-"}</td>
                <td>
                  {activeRooms.length === 0 ? "-" : activeRooms.map((o) => o.room.roomNumber).join(", ")}
                  {isNearExpiry(t) && <span className="badge warning" style={{ marginLeft: 6 }}>ใกล้หมด</span>}
                </td>
                <td>{t.lineUserId ? <span className="badge success">เชื่อมต่อ</span> : <span className="badge neutral">ยังไม่เชื่อม</span>}</td>
                <td onClick={(e) => e.stopPropagation()}>
                  {showArchived ? (
                    <button
                      className="secondary"
                      onClick={() => {
                        const formData = new FormData();
                        formData.set("tenantId", String(t.id));
                        restoreTenant(formData).then(() => notify("กู้คืนแล้ว"));
                      }}
                    >
                      กู้คืน
                    </button>
                  ) : (
                    <button className="secondary" onClick={() => setEditingTenant(t)}>
                      แก้ไข
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {filtered.length === 0 && <p className="empty">ไม่พบผู้เช่าตามเงื่อนไขนี้</p>}

      {showAdd && <TenantFormModal tenant={null} onClose={() => setShowAdd(false)} onSaved={notify} />}
      {editingTenant && <TenantFormModal tenant={editingTenant} onClose={() => setEditingTenant(null)} onSaved={notify} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} onSaved={notify} />}
      {detailTenant && (
        <TenantDetailModal
          tenant={tenants.find((t) => t.id === detailTenant.id) ?? detailTenant}
          onClose={() => setDetailTenant(null)}
          onChanged={notify}
          onEdit={() => {
            setEditingTenant(detailTenant);
            setDetailTenant(null);
          }}
        />
      )}
    </div>
  );
}
