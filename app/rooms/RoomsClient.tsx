"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { RoomWithRelations, TenantOption, BuildingSettings } from "./types";
import { ROOM_STATUS_LABEL, ROOM_STATUS_BADGE_CLASS, rentalTypeLabel } from "@/lib/room-utils";
import RoomFormModal from "./RoomFormModal";
import RoomDetailModal from "./RoomDetailModal";
import BulkCreateModal from "./BulkCreateModal";
import BulkEditModal from "./BulkEditModal";
import { DoorIcon, GridIcon, ListIcon, CheckSquareIcon, PlusIcon, PersonIcon } from "../icons";

type FilterTab = "all" | "monthly" | "daily" | "available" | "occupied" | "maintenance";

const FILTER_LABELS: Record<FilterTab, string> = {
  all: "ทั้งหมด",
  monthly: "รองรับรายเดือน",
  daily: "รองรับรายวัน",
  available: "ว่าง",
  occupied: "มีผู้พัก",
  maintenance: "ปิดปรับปรุง",
};

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

export default function RoomsClient({
  rooms,
  settings,
  tenants,
  buildingName,
}: {
  rooms: RoomWithRelations[];
  settings: BuildingSettings | null;
  tenants: TenantOption[];
  buildingName: string;
}) {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [filter, setFilter] = useState<FilterTab>("all");
  const [multiSelect, setMultiSelect] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [showAdd, setShowAdd] = useState(false);
  const [showBulkCreate, setShowBulkCreate] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [editingRoom, setEditingRoom] = useState<RoomWithRelations | null>(null);
  const [detailRoom, setDetailRoom] = useState<RoomWithRelations | null>(null);
  const [detailInitialTab, setDetailInitialTab] = useState<"ข้อมูลห้อง" | "ผู้เช่า">("ข้อมูลห้อง");
  const [toast, setToast] = useState<string | null>(null);

  const searchParams = useSearchParams();
  useEffect(() => {
    const openRoomId = searchParams.get("openRoom");
    if (!openRoomId) return;
    const room = rooms.find((r) => r.id === Number(openRoomId));
    if (room) {
      setDetailRoom(room);
      if (searchParams.get("tab") === "ผู้เช่า") setDetailInitialTab("ผู้เช่า");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  const counts = useMemo(
    () => ({
      all: rooms.length,
      monthly: rooms.filter((r) => r.rentalTypeSupport !== "daily").length,
      daily: rooms.filter((r) => r.rentalTypeSupport !== "monthly").length,
      available: rooms.filter((r) => r.status === "available").length,
      occupied: rooms.filter((r) => r.status === "occupied").length,
      maintenance: rooms.filter((r) => r.status === "maintenance").length,
    }),
    [rooms]
  );

  const filtered = useMemo(() => {
    switch (filter) {
      case "monthly":
        return rooms.filter((r) => r.rentalTypeSupport !== "daily");
      case "daily":
        return rooms.filter((r) => r.rentalTypeSupport !== "monthly");
      case "available":
        return rooms.filter((r) => r.status === "available");
      case "occupied":
        return rooms.filter((r) => r.status === "occupied");
      case "maintenance":
        return rooms.filter((r) => r.status === "maintenance");
      default:
        return rooms;
    }
  }, [rooms, filter]);

  const floors = useMemo(() => Array.from(new Set(filtered.map((r) => r.floor))).sort((a, b) => a - b), [filtered]);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitMultiSelect() {
    setMultiSelect(false);
    setSelected(new Set());
  }

  const selectedRooms = rooms.filter((r) => selected.has(r.id));

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header-title">
            <DoorIcon size={24} /> จัดการห้องพัก
          </div>
          <p className="page-header-subtitle">สถานะและข้อมูลห้องพักทั้งหมดของ {buildingName}</p>
        </div>
        <div className="page-header-actions">
          <div className="icon-btn-group">
            <button className={`icon-btn${view === "grid" ? " active" : ""}`} onClick={() => setView("grid")} title="Grid">
              <GridIcon size={18} />
            </button>
            <button className={`icon-btn${view === "list" ? " active" : ""}`} onClick={() => setView("list")} title="List">
              <ListIcon size={18} />
            </button>
          </div>
          <button className="secondary" onClick={() => (multiSelect ? exitMultiSelect() : setMultiSelect(true))}>
            <CheckSquareIcon size={16} /> {multiSelect ? "ออกจากโหมดเลือก" : "เลือกหลายห้อง"}
          </button>
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowAddMenu((s) => !s)}>
              <PlusIcon size={16} /> เพิ่มห้องพัก
            </button>
            {showAddMenu && (
              <div className="card" style={{ position: "absolute", right: 0, top: 44, zIndex: 10, padding: 8, margin: 0, width: 200 }}>
                <button
                  className="secondary"
                  style={{ width: "100%", marginBottom: 6 }}
                  onClick={() => {
                    setShowAdd(true);
                    setShowAddMenu(false);
                  }}
                >
                  + เพิ่มห้องพัก
                </button>
                <button
                  className="secondary"
                  style={{ width: "100%" }}
                  onClick={() => {
                    setShowBulkCreate(true);
                    setShowAddMenu(false);
                  }}
                >
                  สร้างหลายห้อง
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      {multiSelect && selected.size > 0 && (
        <div className="bulk-preview-note" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>
            เลือก {selected.size} ห้อง —{" "}
            <button
              type="button"
              className="plain-icon-btn"
              style={{ width: "auto", textDecoration: "underline" }}
              onClick={() => setSelected(new Set())}
            >
              ยกเลิก
            </button>
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setShowBulkEdit(true)}>แก้ไขที่เลือก</button>
            <button
              className="danger"
              onClick={async () => {
                if (!confirm(`ยืนยันลบ ${selected.size} ห้อง?`)) return;
                const { bulkDeleteRooms } = await import("./actions");
                const formData = new FormData();
                selected.forEach((id) => formData.append("roomIds", String(id)));
                const result = await bulkDeleteRooms(formData);
                if (result?.error) alert(result.error);
                else {
                  notify("ลบห้องที่เลือกแล้ว");
                  exitMultiSelect();
                }
              }}
            >
              ลบที่เลือก
            </button>
          </div>
        </div>
      )}

      <div className="tabs">
        {(Object.keys(FILTER_LABELS) as FilterTab[]).map((f) => (
          <button key={f} className={`tab${filter === f ? " active" : ""}`} onClick={() => setFilter(f)}>
            {FILTER_LABELS[f]} ({counts[f]})
          </button>
        ))}
      </div>

      {floors.length === 0 && <p className="empty">ไม่พบห้องพักตามเงื่อนไขนี้</p>}

      {floors.map((floor) => {
        const floorRooms = filtered.filter((r) => r.floor === floor);
        return (
          <div key={floor} className="floor-section">
            <div className="floor-section-header">
              <span className="floor-badge">ชั้น {floor}</span>
              <span className="floor-count">{floorRooms.length} ห้อง</span>
            </div>

            {view === "grid" ? (
              <div className="room-grid">
                {floorRooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    multiSelect={multiSelect}
                    selected={selected.has(room.id)}
                    onToggleSelect={() => toggleSelect(room.id)}
                    onOpen={() => setDetailRoom(room)}
                  />
                ))}
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    {multiSelect && <th></th>}
                    <th>ห้อง</th>
                    <th>ชั้น</th>
                    <th>รองรับ</th>
                    <th>สถานะ</th>
                    <th>ผู้เช่า</th>
                    <th>ราคา/เดือน</th>
                    <th>ราคา/วัน</th>
                  </tr>
                </thead>
                <tbody>
                  {floorRooms.map((room) => {
                    const occ = room.occupancies.find((o) => o.status === "active");
                    return (
                      <tr key={room.id} style={{ cursor: "pointer" }} onClick={() => (multiSelect ? toggleSelect(room.id) : setDetailRoom(room))}>
                        {multiSelect && (
                          <td>
                            <input type="checkbox" checked={selected.has(room.id)} onChange={() => toggleSelect(room.id)} onClick={(e) => e.stopPropagation()} />
                          </td>
                        )}
                        <td>{room.roomNumber}</td>
                        <td>{room.floor}</td>
                        <td>{rentalTypeLabel(room.rentalTypeSupport)}</td>
                        <td>
                          <span className={`badge ${ROOM_STATUS_BADGE_CLASS[room.status]}`}>{ROOM_STATUS_LABEL[room.status]}</span>
                        </td>
                        <td>{occ?.tenant.name ?? "-"}</td>
                        <td>{room.monthlyPrice ?? "-"}</td>
                        <td>{room.dailyPrice ?? "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      {showAdd && <RoomFormModal room={null} settings={settings} onClose={() => setShowAdd(false)} onSaved={notify} />}
      {editingRoom && (
        <RoomFormModal
          room={editingRoom}
          settings={settings}
          onClose={() => setEditingRoom(null)}
          onSaved={notify}
        />
      )}
      {showBulkCreate && <BulkCreateModal onClose={() => setShowBulkCreate(false)} onSaved={notify} />}
      {showBulkEdit && <BulkEditModal rooms={selectedRooms} onClose={() => setShowBulkEdit(false)} onSaved={() => { notify("บันทึกแล้ว"); exitMultiSelect(); }} />}
      {detailRoom && (
        <RoomDetailModal
          room={rooms.find((r) => r.id === detailRoom.id) ?? detailRoom}
          tenants={tenants}
          initialTab={detailInitialTab}
          onClose={() => setDetailRoom(null)}
          onChanged={notify}
          onEdit={() => {
            setEditingRoom(detailRoom);
            setDetailRoom(null);
          }}
        />
      )}
    </div>
  );
}

function RoomCard({
  room,
  multiSelect,
  selected,
  onToggleSelect,
  onOpen,
}: {
  room: RoomWithRelations;
  multiSelect: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
}) {
  const occ = room.occupancies.find((o) => o.status === "active");
  const booking = room.bookings.find((b) => b.status === "pending" || b.status === "confirmed");
  const contract = room.contracts[0];
  const cover = room.images.find((i) => i.id === room.coverImageId) ?? room.images[0];

  const expiryWarning =
    contract?.endDate && !contract.noEndDate
      ? (new Date(contract.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24) <= 60
      : false;

  return (
    <div className={`room-card${selected ? " selected" : ""}`} onClick={() => (multiSelect ? onToggleSelect() : onOpen())} style={{ cursor: "pointer" }}>
      {multiSelect && (
        <input type="checkbox" className="room-card-checkbox" checked={selected} onChange={onToggleSelect} onClick={(e) => e.stopPropagation()} />
      )}
      {cover && <img src={cover.url} alt="" style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 10 }} />}
      <div className="room-card-top">
        <div>
          <div className="room-card-number">{room.roomNumber}</div>
          <div className="room-card-floor">ชั้น {room.floor}</div>
        </div>
        <span className={`status-dot ${room.status}`} title={ROOM_STATUS_LABEL[room.status]} />
      </div>

      <span className={`badge ${ROOM_STATUS_BADGE_CLASS[room.status]}`}>
        {ROOM_STATUS_LABEL[room.status]}
        {room.status === "occupied" && occ && ` (${occ.tenant.tenantType === "monthly" ? "รายเดือน" : "รายวัน"})`}
      </span>
      <span className="price-tag">{rentalTypeLabel(room.rentalTypeSupport)}</span>

      <div className="room-card-prices">
        {room.monthlyPrice && (
          <div className="room-card-price-row">
            <span>รายเดือน</span> <span>฿{room.monthlyPrice.toLocaleString()}</span>
          </div>
        )}
        {room.dailyPrice && (
          <div className="room-card-price-row">
            <span>รายวัน</span> <span>฿{room.dailyPrice.toLocaleString()}</span>
          </div>
        )}
      </div>

      {occ && (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          <PersonIcon size={14} /> {occ.tenant.name} · เข้าพัก {fmtDate(occ.checkinDate)}
          {expiryWarning && <div style={{ color: "var(--warning)" }}>⚠ ใกล้หมดสัญญา {fmtDate(contract?.endDate)}</div>}
        </div>
      )}
      {!occ && booking && (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {booking.tenant?.name ?? "-"} · เข้าพัก {fmtDate(booking.checkinDate)}
        </div>
      )}
      {!occ && !booking && room.status === "available" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
        >
          Check-in
        </button>
      )}
    </div>
  );
}
