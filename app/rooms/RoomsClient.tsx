"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BuildingIcon,
  CheckSquareIcon,
  ChevronDownIcon,
  GridIcon,
  ListIcon,
  PlusIcon,
  SettingsIcon,
  TrashIcon,
  XIcon,
  ZapIcon,
} from "../icons";
import {
  bulkSetRoomStatus,
  createRoom,
  createRoomsBulk,
  createRoomType,
  setRoomStatus,
} from "./actions";

type RoomType = {
  id: number;
  name: string;
  priceDaily: number | null;
  priceMonthly: number | null;
  priceDeposit: number | null;
  maxOccupancy: number | null;
};

type Room = {
  id: number;
  roomNumber: string;
  floor: string | null;
  currentMode: string;
  status: string;
  waterElectricMode: string;
  priceMonthly: number | null;
  priceDaily: number | null;
  roomType: RoomType;
};

const statusLabel: Record<string, string> = {
  available: "ว่าง",
  unavailable: "ไม่ว่าง",
  blocked: "ปิดปรับปรุง",
};

type BulkRow = {
  key: string;
  roomNumber: string;
  floor: string;
  mode: string;
  priceMonthly: string;
  priceDaily: string;
  status: string;
};

function makeKey() {
  return Math.random().toString(36).slice(2);
}

function generateBulkRows(
  startFloor: number,
  endFloor: number,
  startNum: number,
  endNum: number,
  usePrefix: boolean,
  monthlyPrice: string,
  dailyPrice: string,
  mode: string
): BulkRow[] {
  const rows: BulkRow[] = [];
  if (!startFloor || !endFloor || !startNum || !endNum || startFloor > endFloor || startNum > endNum) {
    return rows;
  }
  for (let floor = startFloor; floor <= endFloor; floor++) {
    for (let n = startNum; n <= endNum; n++) {
      const roomNumber = usePrefix ? `${floor}${String(n).padStart(2, "0")}` : String(n);
      rows.push({
        key: makeKey(),
        roomNumber,
        floor: String(floor),
        mode,
        priceMonthly: monthlyPrice,
        priceDaily: dailyPrice,
        status: "available",
      });
    }
  }
  return rows;
}

export default function RoomsClient({ rooms, roomTypes }: { rooms: Room[]; roomTypes: RoomType[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeTab, setActiveTab] = useState<"all" | "monthly" | "daily" | "available">("all");
  const [multiSelect, setMultiSelect] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [collapsedFloors, setCollapsedFloors] = useState<Set<string>>(new Set());

  const [showAddModal, setShowAddModal] = useState(false);
  const [addTab, setAddTab] = useState<"single" | "bulk">("single");
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [singleError, setSingleError] = useState<string | null>(null);

  const [startFloor, setStartFloor] = useState("1");
  const [endFloor, setEndFloor] = useState("1");
  const [startNum, setStartNum] = useState("1");
  const [endNum, setEndNum] = useState("10");
  const [monthlyPrice, setMonthlyPrice] = useState("3000");
  const [dailyPrice, setDailyPrice] = useState("500");
  const [usePrefix, setUsePrefix] = useState(true);
  const [bulkMode, setBulkMode] = useState("monthly");
  const [bulkRows, setBulkRows] = useState<BulkRow[]>(() =>
    generateBulkRows(1, 1, 1, 10, true, "3000", "500", "monthly")
  );
  const [selectedRowKeys, setSelectedRowKeys] = useState<Set<string>>(new Set());

  function showToast(text: string) {
    setToast(text);
    setTimeout(() => setToast(null), 3500);
  }

  function regenerateRows(overrides: Partial<{
    startFloor: string;
    endFloor: string;
    startNum: string;
    endNum: string;
    usePrefix: boolean;
    monthlyPrice: string;
    dailyPrice: string;
    mode: string;
  }> = {}) {
    const sf = Number(overrides.startFloor ?? startFloor);
    const ef = Number(overrides.endFloor ?? endFloor);
    const sn = Number(overrides.startNum ?? startNum);
    const en = Number(overrides.endNum ?? endNum);
    const up = overrides.usePrefix ?? usePrefix;
    const mp = overrides.monthlyPrice ?? monthlyPrice;
    const dp = overrides.dailyPrice ?? dailyPrice;
    const md = overrides.mode ?? bulkMode;
    setBulkRows(generateBulkRows(sf, ef, sn, en, up, mp, dp, md));
  }

  const counts = useMemo(() => {
    return {
      all: rooms.length,
      monthly: rooms.filter((r) => r.currentMode === "monthly").length,
      daily: rooms.filter((r) => r.currentMode === "daily").length,
      available: rooms.filter((r) => r.status === "available").length,
    };
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    if (activeTab === "monthly") return rooms.filter((r) => r.currentMode === "monthly");
    if (activeTab === "daily") return rooms.filter((r) => r.currentMode === "daily");
    if (activeTab === "available") return rooms.filter((r) => r.status === "available");
    return rooms;
  }, [rooms, activeTab]);

  const floorGroups = useMemo(() => {
    const groups = new Map<string, Room[]>();
    for (const room of filteredRooms) {
      const key = room.floor || "ไม่ระบุชั้น";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(room);
    }
    return Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0], "th", { numeric: true }));
  }, [filteredRooms]);

  function toggleFloorCollapse(floor: string) {
    setCollapsedFloors((prev) => {
      const next = new Set(prev);
      if (next.has(floor)) next.delete(floor);
      else next.add(floor);
      return next;
    });
  }

  function toggleSelected(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBulkStatusChange(status: string) {
    startTransition(async () => {
      await bulkSetRoomStatus(Array.from(selectedIds), status);
      showToast(`เปลี่ยนสถานะ ${selectedIds.size} ห้องแล้ว`);
      setSelectedIds(new Set());
      router.refresh();
    });
  }

  async function handleSingleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSingleError(null);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const result = await createRoom(formData);
      if (result?.error) {
        setSingleError(result.error);
        return;
      }
      showToast("เพิ่มห้องพักสำเร็จ");
      setShowAddModal(false);
      router.refresh();
    });
  }

  function handleBulkSubmit() {
    const rowsPayload = bulkRows.map((r) => ({
      roomNumber: r.roomNumber,
      floor: r.floor,
      mode: r.mode,
      priceMonthly: r.priceMonthly ? Number(r.priceMonthly) : null,
      priceDaily: r.priceDaily ? Number(r.priceDaily) : null,
      status: r.status,
    }));
    startTransition(async () => {
      const result = await createRoomsBulk(rowsPayload);
      if (result.skipped > 0) {
        showToast(`สร้างสำเร็จ ${result.created} ห้อง ข้ามซ้ำ ${result.skipped} ห้อง (${result.skippedNumbers.join(", ")})`);
      } else {
        showToast(`สร้างสำเร็จ ${result.created} ห้อง`);
      }
      setShowAddModal(false);
      router.refresh();
    });
  }

  function updateRow(key: string, field: keyof BulkRow, value: string) {
    setBulkRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  }

  function removeRow(key: string) {
    setBulkRows((prev) => prev.filter((r) => r.key !== key));
  }

  function removeFloorRows(floor: string) {
    setBulkRows((prev) => prev.filter((r) => r.floor !== floor));
  }

  const bulkFloorGroups = useMemo(() => {
    const groups = new Map<string, BulkRow[]>();
    for (const row of bulkRows) {
      if (!groups.has(row.floor)) groups.set(row.floor, []);
      groups.get(row.floor)!.push(row);
    }
    return Array.from(groups.entries());
  }, [bulkRows]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header-title">
            <BuildingIcon size={24} />
            จัดการห้องพัก
            <button
              type="button"
              className="plain-icon-btn"
              style={{ color: "var(--muted)" }}
              onClick={() => setShowTypeModal(true)}
              title="ประเภทห้อง"
            >
              <SettingsIcon size={18} />
            </button>
          </div>
          <p className="page-header-subtitle">สถานะและข้อมูลห้องพักทั้งหมดของคุณ</p>
        </div>
        <div className="page-header-actions">
          <div className="icon-btn-group">
            <button
              type="button"
              className={`icon-btn ${viewMode === "grid" ? "active" : ""}`}
              onClick={() => setViewMode("grid")}
              title="มุมมองการ์ด"
            >
              <GridIcon size={18} />
            </button>
            <button
              type="button"
              className={`icon-btn ${viewMode === "list" ? "active" : ""}`}
              onClick={() => setViewMode("list")}
              title="มุมมองตาราง"
            >
              <ListIcon size={18} />
            </button>
          </div>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setMultiSelect((v) => !v);
              setSelectedIds(new Set());
            }}
          >
            <CheckSquareIcon size={16} />
            เลือกหลายห้อง
          </button>
          <button type="button" className="secondary" onClick={() => setShowTypeModal(true)}>
            <SettingsIcon size={16} />
            ประเภทห้อง
          </button>
          <button type="button" onClick={() => setShowAddModal(true)}>
            <PlusIcon size={16} />
            เพิ่มห้องพัก
          </button>
        </div>
      </div>

      <div className="tabs">
        <div className={`tab ${activeTab === "all" ? "active" : ""}`} onClick={() => setActiveTab("all")}>
          ทั้งหมด ({counts.all})
        </div>
        <div
          className={`tab ${activeTab === "monthly" ? "active" : ""}`}
          onClick={() => setActiveTab("monthly")}
        >
          รองรับรายเดือน ({counts.monthly})
        </div>
        <div className={`tab ${activeTab === "daily" ? "active" : ""}`} onClick={() => setActiveTab("daily")}>
          รองรับรายวัน ({counts.daily})
        </div>
        <div
          className={`tab ${activeTab === "available" ? "active" : ""}`}
          onClick={() => setActiveTab("available")}
        >
          ว่าง ({counts.available})
        </div>
      </div>

      {multiSelect && selectedIds.size > 0 && (
        <div className="card" style={{ padding: 14, marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 14 }}>เลือกแล้ว {selectedIds.size} ห้อง — เปลี่ยนสถานะเป็น:</span>
          <div className="status-buttons">
            <button type="button" className="secondary" onClick={() => handleBulkStatusChange("available")}>
              ว่าง
            </button>
            <button type="button" className="secondary" onClick={() => handleBulkStatusChange("unavailable")}>
              ไม่ว่าง
            </button>
            <button type="button" className="secondary" onClick={() => handleBulkStatusChange("blocked")}>
              ปิดปรับปรุง
            </button>
          </div>
        </div>
      )}

      {rooms.length === 0 ? (
        <p className="empty">ยังไม่มีห้องพัก — กด "เพิ่มห้องพัก" เพื่อเริ่มต้น</p>
      ) : viewMode === "list" ? (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>เลขห้อง</th>
                <th>ชั้น</th>
                <th>รูปแบบ</th>
                <th>ราคา/เดือน</th>
                <th>ราคา/วัน</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {filteredRooms.map((room) => (
                <tr key={room.id}>
                  <td>{room.roomNumber}</td>
                  <td>{room.floor ?? "-"}</td>
                  <td>{room.currentMode === "daily" ? "รายวัน" : "รายเดือน"}</td>
                  <td>{room.priceMonthly ?? room.roomType.priceMonthly ?? "-"}</td>
                  <td>{room.priceDaily ?? room.roomType.priceDaily ?? "-"}</td>
                  <td>
                    <select
                      key={room.status}
                      className="room-card-status-select"
                      defaultValue={room.status}
                      onChange={(e) => {
                        startTransition(async () => {
                          await setRoomStatus(room.id, e.target.value);
                          router.refresh();
                        });
                      }}
                    >
                      <option value="available">ว่าง</option>
                      <option value="unavailable">ไม่ว่าง</option>
                      <option value="blocked">ปิดปรับปรุง</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        floorGroups.map(([floor, floorRooms]) => (
          <div key={floor} className="floor-section">
            <div className="floor-section-header">
              <span className="floor-badge">ชั้น {floor}</span>
              <span className="floor-count">{floorRooms.length} ห้อง</span>
            </div>
            <div className="room-grid">
              {floorRooms.map((room) => {
                const effMonthly = room.priceMonthly ?? room.roomType.priceMonthly;
                const effDaily = room.priceDaily ?? room.roomType.priceDaily;
                const selected = selectedIds.has(room.id);
                return (
                  <div key={room.id} className={`room-card ${selected ? "selected" : ""}`}>
                    {multiSelect && (
                      <input
                        type="checkbox"
                        className="room-card-checkbox"
                        checked={selected}
                        onChange={() => toggleSelected(room.id)}
                      />
                    )}
                    <div className="room-card-top" style={{ marginLeft: multiSelect ? 22 : 0 }}>
                      <div>
                        <div className="room-card-number">{room.roomNumber}</div>
                        <div className="room-card-floor">ชั้น {room.floor ?? "-"}</div>
                      </div>
                      <span className={`status-dot ${room.status}`} title={statusLabel[room.status]} />
                    </div>

                    <span className={`badge ${room.status}`} style={{ width: "fit-content" }}>
                      {statusLabel[room.status]}
                    </span>

                    <div className="room-card-prices">
                      {effMonthly != null && (
                        <div className="room-card-price-row">
                          <span>฿{effMonthly.toLocaleString()}/เดือน</span>
                          <span className="price-tag">รายเดือน</span>
                        </div>
                      )}
                      {effDaily != null && (
                        <div className="room-card-price-row">
                          <span>฿{effDaily.toLocaleString()}/วัน</span>
                          <span className="price-tag">รายวัน</span>
                        </div>
                      )}
                    </div>

                    <select
                      key={room.status}
                      className="room-card-status-select"
                      defaultValue={room.status}
                      onChange={(e) => {
                        startTransition(async () => {
                          await setRoomStatus(room.id, e.target.value);
                          router.refresh();
                        });
                      }}
                    >
                      <option value="available">ว่าง</option>
                      <option value="unavailable">ไม่ว่าง</option>
                      <option value="blocked">ปิดปรับปรุง</option>
                    </select>

                    {room.status === "available" && (
                      <a
                        href={`/bookings?roomId=${room.id}`}
                        className="btn secondary"
                        style={{ width: "100%", fontSize: 13 }}
                      >
                        <ZapIcon size={14} />
                        Check-in ด่วน
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* ---------- Add room modal ---------- */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div
            className={`modal ${addTab === "bulk" ? "modal-wide" : ""}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2>เพิ่มห้องพัก</h2>
              <button type="button" className="modal-close" onClick={() => setShowAddModal(false)}>
                <XIcon size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-tabs">
                <button
                  type="button"
                  className={`modal-tab ${addTab === "single" ? "active" : ""}`}
                  onClick={() => setAddTab("single")}
                >
                  ทีละห้อง
                </button>
                <button
                  type="button"
                  className={`modal-tab ${addTab === "bulk" ? "active" : ""}`}
                  onClick={() => setAddTab("bulk")}
                >
                  หลายห้องพร้อมกัน
                </button>
              </div>

              {addTab === "single" ? (
                <form id="single-room-form" onSubmit={handleSingleSubmit}>
                  {singleError && <div className="form-error">{singleError}</div>}
                  <div className="form-row">
                    <div className="field">
                      <label>เลขห้อง</label>
                      <input name="roomNumber" placeholder="เช่น 101" required />
                    </div>
                    <div className="field">
                      <label>ชั้น</label>
                      <input name="floor" placeholder="เช่น 1" />
                    </div>
                    <div className="field">
                      <label>ประเภทห้อง</label>
                      <select name="roomTypeId" required disabled={roomTypes.length === 0}>
                        {roomTypes.length === 0 && <option value="">ยังไม่มีประเภทห้อง</option>}
                        {roomTypes.map((rt) => (
                          <option key={rt.id} value={rt.id}>
                            {rt.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>รูปแบบการเช่า</label>
                      <select name="currentMode">
                        <option value="monthly">รายเดือน</option>
                        <option value="daily">รายวัน</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-row" style={{ marginTop: 12 }}>
                    <div className="field">
                      <label>ราคา/เดือน (บาท) — เว้นว่างถ้าใช้ราคาตามประเภทห้อง</label>
                      <input name="priceMonthly" type="number" step="0.01" />
                    </div>
                    <div className="field">
                      <label>ราคา/วัน (บาท)</label>
                      <input name="priceDaily" type="number" step="0.01" />
                    </div>
                    <div className="field">
                      <label>น้ำ-ไฟ</label>
                      <select name="waterElectricMode">
                        <option value="metered">มิเตอร์</option>
                        <option value="flat_rate">เหมาจ่าย</option>
                      </select>
                    </div>
                    <div className="field">
                      <label>สถานะเริ่มต้น</label>
                      <select name="status">
                        <option value="available">ว่าง</option>
                        <option value="unavailable">ไม่ว่าง</option>
                        <option value="blocked">ปิดปรับปรุง</option>
                      </select>
                    </div>
                  </div>
                </form>
              ) : (
                <div>
                  <div className="card" style={{ background: "var(--bg)", boxShadow: "none" }}>
                    <h2 style={{ fontSize: 15 }}>✨ สร้างห้องอัตโนมัติ</h2>
                    <p style={{ fontSize: 13, color: "var(--muted)", marginTop: -8 }}>
                      กรอกช่วงชั้น เลขห้อง และราคา — ตารางด้านล่างจะแสดงห้องให้อัตโนมัติทันที
                    </p>
                    <div className="form-row">
                      <div className="field">
                        <label>ชั้นเริ่มต้น</label>
                        <input
                          type="number"
                          value={startFloor}
                          onChange={(e) => {
                            setStartFloor(e.target.value);
                            regenerateRows({ startFloor: e.target.value });
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>ชั้นสิ้นสุด</label>
                        <input
                          type="number"
                          value={endFloor}
                          onChange={(e) => {
                            setEndFloor(e.target.value);
                            regenerateRows({ endFloor: e.target.value });
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>เลขห้องเริ่มต้น</label>
                        <input
                          type="number"
                          value={startNum}
                          onChange={(e) => {
                            setStartNum(e.target.value);
                            regenerateRows({ startNum: e.target.value });
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>เลขห้องสิ้นสุด</label>
                        <input
                          type="number"
                          value={endNum}
                          onChange={(e) => {
                            setEndNum(e.target.value);
                            regenerateRows({ endNum: e.target.value });
                          }}
                        />
                      </div>
                    </div>
                    <div className="form-row">
                      <div className="field">
                        <label>ราคารายเดือน (บาท)</label>
                        <input
                          type="number"
                          value={monthlyPrice}
                          onChange={(e) => {
                            setMonthlyPrice(e.target.value);
                            regenerateRows({ monthlyPrice: e.target.value });
                          }}
                        />
                      </div>
                      <div className="field">
                        <label>ราคารายวัน (บาท)</label>
                        <input
                          type="number"
                          value={dailyPrice}
                          onChange={(e) => {
                            setDailyPrice(e.target.value);
                            regenerateRows({ dailyPrice: e.target.value });
                          }}
                        />
                      </div>
                      <div className="field" style={{ justifyContent: "flex-end" }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <input
                            type="checkbox"
                            checked={usePrefix}
                            onChange={(e) => {
                              setUsePrefix(e.target.checked);
                              regenerateRows({ usePrefix: e.target.checked });
                            }}
                          />
                          ใช้เลขชั้นนำหน้า (เช่น 101, 102, ...)
                        </label>
                      </div>
                      <div className="field">
                        <label>รูปแบบการเช่า</label>
                        <select
                          value={bulkMode}
                          onChange={(e) => {
                            setBulkMode(e.target.value);
                            regenerateRows({ mode: e.target.value });
                          }}
                        >
                          <option value="monthly">รายเดือน</option>
                          <option value="daily">รายวัน</option>
                        </select>
                      </div>
                    </div>
                    <div className="bulk-preview-note">
                      ตารางด้านล่างแสดง <strong>{bulkRows.length}</strong> ห้อง — แก้ไขรายห้องในตารางได้
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "16px 0 8px" }}>
                    <strong>รายการห้องที่จะสร้าง ({bulkRows.length})</strong>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        setBulkRows((prev) => [
                          ...prev,
                          {
                            key: makeKey(),
                            roomNumber: "",
                            floor: startFloor,
                            mode: bulkMode,
                            priceMonthly: monthlyPrice,
                            priceDaily: dailyPrice,
                            status: "available",
                          },
                        ])
                      }
                    >
                      <PlusIcon size={14} />
                      เพิ่มแถว
                    </button>
                  </div>

                  <div className="bulk-table" style={{ maxHeight: 320, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 10 }}>
                    {bulkFloorGroups.length === 0 ? (
                      <p className="empty" style={{ padding: 16 }}>
                        ยังไม่มีห้อง — ปรับช่วงชั้น/เลขห้องด้านบน หรือกด "เพิ่มแถว"
                      </p>
                    ) : (
                      bulkFloorGroups.map(([floor, floorRows]) => (
                        <div key={floor} style={{ borderBottom: "1px solid var(--border)" }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              padding: "8px 12px",
                              background: "var(--bg)",
                              fontSize: 13,
                              fontWeight: 700,
                            }}
                          >
                            <span>
                              <BuildingIcon size={14} /> ชั้น {floor} ({floorRows.length} ห้อง)
                            </span>
                            <button
                              type="button"
                              className="plain-icon-btn"
                              onClick={() => removeFloorRows(floor)}
                              title="ลบทั้งชั้น"
                            >
                              <TrashIcon size={15} />
                            </button>
                          </div>
                          <table>
                            <thead>
                              <tr>
                                <th>เลขห้อง</th>
                                <th>ประเภท</th>
                                <th>ราคา/เดือน</th>
                                <th>ราคา/วัน</th>
                                <th>สถานะ</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {floorRows.map((row) => (
                                <tr key={row.key}>
                                  <td>
                                    <input
                                      value={row.roomNumber}
                                      onChange={(e) => updateRow(row.key, "roomNumber", e.target.value)}
                                    />
                                  </td>
                                  <td>
                                    <select
                                      value={row.mode}
                                      onChange={(e) => updateRow(row.key, "mode", e.target.value)}
                                    >
                                      <option value="monthly">รายเดือน</option>
                                      <option value="daily">รายวัน</option>
                                    </select>
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      value={row.priceMonthly}
                                      onChange={(e) => updateRow(row.key, "priceMonthly", e.target.value)}
                                    />
                                  </td>
                                  <td>
                                    <input
                                      type="number"
                                      value={row.priceDaily}
                                      onChange={(e) => updateRow(row.key, "priceDaily", e.target.value)}
                                    />
                                  </td>
                                  <td>
                                    <select
                                      value={row.status}
                                      onChange={(e) => updateRow(row.key, "status", e.target.value)}
                                    >
                                      <option value="available">ว่าง</option>
                                      <option value="unavailable">ไม่ว่าง</option>
                                      <option value="blocked">ปิดปรับปรุง</option>
                                    </select>
                                  </td>
                                  <td>
                                    <button
                                      type="button"
                                      className="plain-icon-btn"
                                      onClick={() => removeRow(row.key)}
                                    >
                                      <TrashIcon size={15} />
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <span style={{ color: "var(--muted)", fontSize: 14 }}>
                {addTab === "bulk" ? `ทั้งหมด ${bulkRows.length} ห้อง` : ""}
              </span>
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button" className="secondary" onClick={() => setShowAddModal(false)}>
                  ยกเลิก
                </button>
                {addTab === "single" ? (
                  <button type="submit" form="single-room-form">
                    เพิ่มห้องพัก
                  </button>
                ) : (
                  <button type="button" onClick={handleBulkSubmit} disabled={bulkRows.length === 0}>
                    สร้างทั้งหมด ({bulkRows.length} ห้อง)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Room type modal ---------- */}
      {showTypeModal && (
        <div className="modal-overlay" onClick={() => setShowTypeModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>ประเภทห้อง</h2>
              <button type="button" className="modal-close" onClick={() => setShowTypeModal(false)}>
                <XIcon size={18} />
              </button>
            </div>
            <div className="modal-body">
              {roomTypes.length === 0 ? (
                <p className="empty">ยังไม่มีประเภทห้อง</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>ชื่อ</th>
                      <th>ราคา/วัน</th>
                      <th>ราคา/เดือน</th>
                      <th>มัดจำ</th>
                      <th>คนสูงสุด</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roomTypes.map((rt) => (
                      <tr key={rt.id}>
                        <td>{rt.name}</td>
                        <td>{rt.priceDaily ?? "-"}</td>
                        <td>{rt.priceMonthly ?? "-"}</td>
                        <td>{rt.priceDeposit ?? "-"}</td>
                        <td>{rt.maxOccupancy ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <form
                action={createRoomType}
                className="form-row"
                style={{ marginTop: 16 }}
                onSubmit={() => setTimeout(() => showToast("เพิ่มประเภทห้องสำเร็จ"), 100)}
              >
                <div className="field">
                  <label>ชื่อประเภทห้อง</label>
                  <input name="name" placeholder="เช่น เตียงเดี่ยว" required />
                </div>
                <div className="field">
                  <label>ราคา/วัน (บาท)</label>
                  <input name="priceDaily" type="number" step="0.01" />
                </div>
                <div className="field">
                  <label>ราคา/เดือน (บาท)</label>
                  <input name="priceMonthly" type="number" step="0.01" />
                </div>
                <div className="field">
                  <label>เงินมัดจำ (บาท)</label>
                  <input name="priceDeposit" type="number" step="0.01" />
                </div>
                <div className="field">
                  <label>จำนวนคนสูงสุด</label>
                  <input name="maxOccupancy" type="number" />
                </div>
                <button type="submit">เพิ่มประเภทห้อง</button>
              </form>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
