"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Bill, BillLineItem, Payment, Room, Tenant, RoomOccupancy, Contract } from "@prisma/client";
import { issueSingleBill, issueBulkBills, issueMoveInBill } from "./actions";
import { WalletIcon, PlusIcon, CheckSquareIcon, HistoryIcon } from "../icons";
import MonthNav from "../MonthNav";

function fmtMoney2(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

type BillRow = Bill & { room: Room; tenant: Tenant; lineItems: BillLineItem[]; payments: Payment[] };
type RoomOption = Room & { occupancies: (RoomOccupancy & { tenant: Tenant })[] };
type MoveInCandidate = Contract & { tenant: Tenant; room: Room };

function billBalance(b: BillRow) {
  const total = b.lineItems.reduce((s, li) => s + li.amount, 0) - (b.discountAmount ?? 0);
  const paid = b.payments.reduce((s, p) => s + p.amount, 0);
  return { total, paid, balance: total - paid };
}

function billOverdue(b: BillRow) {
  return b.status !== "paid" && b.status !== "cancelled" && new Date(b.dueDate).getTime() < Date.now();
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<string, string> = {
  unpaid: "รอชำระ",
  partially_paid: "ชำระบางส่วน",
  pending_review: "รอตรวจสอบ",
  paid: "ชำระแล้ว",
  cancelled: "ยกเลิก",
};
const STATUS_BADGE_CLASS: Record<string, string> = {
  unpaid: "warning",
  partially_paid: "warning",
  pending_review: "neutral",
  paid: "success",
  cancelled: "neutral",
};
const STATUS_BG: Record<string, string> = {
  unpaid: "var(--warning-soft)",
  partially_paid: "var(--warning-soft)",
  pending_review: "var(--surface-2)",
  paid: "var(--success-soft)",
  cancelled: "var(--surface-2)",
};

type StatusFilter = "all" | "unpaid" | "partially_paid" | "pending_review" | "paid" | "overdue";
const FILTER_CHIPS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "ทั้งหมด" },
  { key: "unpaid", label: "รอชำระ" },
  { key: "partially_paid", label: "ชำระบางส่วน" },
  { key: "pending_review", label: "รอตรวจสอบ" },
  { key: "paid", label: "ชำระแล้ว" },
  { key: "overdue", label: "เกินกำหนด" },
];

export default function BillsClient({
  bills,
  rooms,
  moveInCandidates,
  buildingName,
}: {
  bills: BillRow[];
  rooms: RoomOption[];
  moveInCandidates: MoveInCandidate[];
  buildingName: string;
}) {
  const router = useRouter();
  const [month, setMonth] = useState(currentMonthKey());
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showMenu, setShowMenu] = useState(false);
  const [showSingle, setShowSingle] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showMoveIn, setShowMoveIn] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [multiSelect, setMultiSelect] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());

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

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  function sendLineToAll() {
    if (!confirm("ส่งแจ้งเตือน LINE บิลของงวดนี้ให้ทุกห้องที่มีบิล?")) return;
    // หมายเหตุ: ยังไม่มีการเชื่อมต่อ LINE OA จริงในระบบ (เหมือนโมดูลพัสดุ) — ปุ่มนี้เป็นแค่ mock ไว้ก่อน
    notify("ส่งแจ้งเตือน LINE ให้ทุกห้องแล้ว (จำลอง — ยังไม่เชื่อมต่อ LINE OA จริง)");
  }

  const billsThisMonth = useMemo(() => bills.filter((b) => b.billingMonth === month), [bills, month]);
  const billByRoomId = useMemo(() => {
    const map = new Map<number, BillRow>();
    for (const b of billsThisMonth) map.set(b.roomId, b);
    return map;
  }, [billsThisMonth]);

  const stats = useMemo(() => {
    const all = { count: 0, amount: 0 };
    const pending = { count: 0, amount: 0 };
    const paid = { count: 0, amount: 0 };
    const overdue = { count: 0, amount: 0 };
    for (const b of billsThisMonth) {
      if (b.status === "cancelled") continue;
      const { total, balance } = billBalance(b);
      all.count++;
      all.amount += total;
      if (b.status === "unpaid") {
        pending.count++;
        pending.amount += balance;
      }
      if (b.status === "paid") {
        paid.count++;
        paid.amount += total;
      }
      if (billOverdue(b)) {
        overdue.count++;
        overdue.amount += balance;
      }
    }
    return { all, pending, paid, overdue };
  }, [billsThisMonth]);

  const floors = useMemo(() => Array.from(new Set(rooms.map((r) => r.floor))).sort((a, b) => a - b), [rooms]);

  function roomVisible(room: RoomOption) {
    if (statusFilter === "all") return true;
    const activeTenant = room.occupancies[0]?.tenant;
    if (activeTenant?.tenantType === "daily") return false; // ห้องรายวันไม่มี Bill ให้กรองด้วยสถานะนี้
    const bill = billByRoomId.get(room.id);
    if (!bill) return false;
    if (statusFilter === "overdue") return billOverdue(bill);
    return bill.status === statusFilter;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header-title">
            <WalletIcon size={24} /> บิลค่าเช่า
          </div>
          <p className="page-header-subtitle">จัดการบิลรายเดือนของแต่ละห้อง</p>
        </div>
        <div className="page-header-actions">
          <MonthNav month={month} onChange={setMonth} />
          <button type="button" className="secondary" onClick={() => router.refresh()} title="รีเฟรช">
            ↻
          </button>
          <a href="/bills/receipts" className="secondary btn">
            <HistoryIcon size={16} /> ประวัติสลิป
          </a>
          <button type="button" onClick={sendLineToAll} style={{ background: "var(--success)" }}>
            ✈ ส่ง LINE ทุกห้อง
          </button>
          <div style={{ position: "relative" }}>
            <button onClick={() => setShowMenu((s) => !s)}>
              <PlusIcon size={16} /> ออกบิล
            </button>
            {showMenu && (
              <div className="card" style={{ position: "absolute", right: 0, top: 44, zIndex: 10, padding: 8, margin: 0, width: 220 }}>
                <button className="secondary" style={{ width: "100%", marginBottom: 6 }} onClick={() => { setShowSingle(true); setShowMenu(false); }}>
                  ออกบิลรายห้อง
                </button>
                <button className="secondary" style={{ width: "100%", marginBottom: 6 }} onClick={() => { setShowBulk(true); setShowMenu(false); }}>
                  ออกบิลทุกห้อง
                </button>
                <button className="secondary" style={{ width: "100%" }} onClick={() => { setShowMoveIn(true); setShowMenu(false); }}>
                  บิลแรกเข้า
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">ทั้งหมด</div>
          <div className="value">{stats.all.count} รายการ</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>฿{fmtMoney2(stats.all.amount)}</div>
        </div>
        <div className="stat-card">
          <div className="label">รอชำระ</div>
          <div className="value">{stats.pending.count} รายการ</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>฿{fmtMoney2(stats.pending.amount)}</div>
        </div>
        <div className="stat-card">
          <div className="label">ชำระแล้ว</div>
          <div className="value">{stats.paid.count} รายการ</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>฿{fmtMoney2(stats.paid.amount)}</div>
        </div>
        <div className="stat-card">
          <div className="label">เกินกำหนด</div>
          <div className="value">{stats.overdue.count} รายการ</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>฿{fmtMoney2(stats.overdue.amount)}</div>
        </div>
      </div>

      {multiSelect ? (
        <div className="bulk-preview-note" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <span>
            เลือก {selected.size} บิล —{" "}
            <button type="button" className="plain-icon-btn" style={{ width: "auto", textDecoration: "underline" }} onClick={exitMultiSelect}>
              ออกจากโหมดเลือก
            </button>
          </span>
          {selected.size > 0 && (
            <a className="btn" href={`/bills/print?ids=${Array.from(selected).join(",")}`} target="_blank" rel="noopener noreferrer">
              พิมพ์ที่เลือก ({selected.size})
            </a>
          )}
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <button type="button" className="secondary" onClick={() => setMultiSelect(true)}>
            <CheckSquareIcon size={16} /> เลือกหลายบิล
          </button>
        </div>
      )}

      <div className="tabs">
        {FILTER_CHIPS.map((c) => (
          <button key={c.key} className={`tab${statusFilter === c.key ? " active" : ""}`} onClick={() => setStatusFilter(c.key)}>
            {c.label}
          </button>
        ))}
      </div>

      {floors.map((floor) => {
        const floorRooms = rooms.filter((r) => r.floor === floor && roomVisible(r));
        if (floorRooms.length === 0) return null;
        return (
          <div key={floor} className="floor-section">
            <div className="floor-section-header">
              <span className="floor-badge">ชั้น {floor}</span>
              <span className="floor-count">{floorRooms.length} ห้อง</span>
            </div>
            <div className="room-grid">
              {floorRooms.map((room) => (
                <BillRoomCard
                  key={room.id}
                  room={room}
                  bill={billByRoomId.get(room.id) ?? null}
                  multiSelect={multiSelect}
                  selected={!!billByRoomId.get(room.id) && selected.has(billByRoomId.get(room.id)!.id)}
                  onToggleSelect={() => {
                    const b = billByRoomId.get(room.id);
                    if (b) toggleSelect(b.id);
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}
      {floors.every((f) => rooms.filter((r) => r.floor === f && roomVisible(r)).length === 0) && (
        <p className="empty">ไม่พบห้องตามเงื่อนไขนี้</p>
      )}

      {showSingle && <IssueSingleModal rooms={rooms} month={month} onClose={() => setShowSingle(false)} onDone={notify} />}
      {showBulk && <IssueBulkModal month={month} onClose={() => setShowBulk(false)} onDone={notify} />}
      {showMoveIn && <IssueMoveInModal candidates={moveInCandidates} onClose={() => setShowMoveIn(false)} onDone={notify} />}
    </div>
  );
}

function BillRoomCard({
  room,
  bill,
  multiSelect,
  selected,
  onToggleSelect,
}: {
  room: RoomOption;
  bill: BillRow | null;
  multiSelect: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const activeTenant = room.occupancies[0]?.tenant;
  const isDaily = activeTenant?.tenantType === "daily";

  const bg = isDaily ? "var(--accent-soft)" : bill ? STATUS_BG[bill.status] : undefined;

  function handleClick() {
    if (isDaily) {
      window.location.href = "/accounting";
      return;
    }
    if (!bill) return;
    if (multiSelect) onToggleSelect();
    else window.location.href = `/bills/${bill.id}`;
  }

  return (
    <div
      className={`room-card${selected ? " selected" : ""}`}
      style={{ background: bg, cursor: isDaily || bill ? "pointer" : "default" }}
      onClick={handleClick}
    >
      {multiSelect && bill && (
        <input
          type="checkbox"
          className="room-card-checkbox"
          checked={selected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <div className="room-card-top">
        <div>
          {isDaily ? (
            <span className="rental-tag daily">รายวัน</span>
          ) : bill ? (
            <span className={`badge ${billOverdue(bill) ? "danger" : STATUS_BADGE_CLASS[bill.status]}`}>
              {billOverdue(bill) ? "เกินกำหนด" : STATUS_LABEL[bill.status]}
            </span>
          ) : null}
        </div>
      </div>
      <div className="room-card-number">{room.roomNumber}</div>
      {isDaily ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>บิลรายวันที่หน้าบัญชี</div>
      ) : bill ? (
        <div style={{ fontSize: 15, fontWeight: 700 }}>
          ฿{billBalance(bill).total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </div>
      ) : (
        <div style={{ fontSize: 14, color: "var(--text-muted)" }}>-</div>
      )}
    </div>
  );
}

function IssueSingleModal({ rooms, month, onClose, onDone }: { rooms: RoomOption[]; month: string; onClose: () => void; onDone: (msg: string) => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const occupiedRooms = rooms.filter((r) => r.occupancies.length > 0 && r.occupancies[0].tenant.tenantType === "monthly");

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await issueSingleBill(formData);
      if (result?.error) setError(result.error);
      else if (result?.warning) {
        onDone(`ออกบิลแล้ว (${result.warning})`);
        onClose();
      }
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>ออกบิลรายห้อง</h2>
        </div>
        <form action={handleSubmit}>
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}
            <div className="field">
              <label>ห้อง (แสดงเฉพาะห้องมีผู้เช่ารายเดือน)</label>
              <select name="roomId" required>
                <option value="">-- เลือกห้อง --</option>
                {occupiedRooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.roomNumber} — {r.occupancies[0].tenant.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>งวดบิล (เดือน)</label>
              <input name="billingMonth" type="month" required defaultValue={month} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="secondary" onClick={onClose}>
              ยกเลิก
            </button>
            <button type="submit" disabled={pending}>
              ออกบิล
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function IssueBulkModal({ month, onClose, onDone }: { month: string; onClose: () => void; onDone: (msg: string) => void }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ issued: number; skipped: string[] } | null>(null);

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const res = await issueBulkBills(formData);
      if (res?.success) {
        setResult({ issued: res.issued, skipped: res.skipped });
        onDone(`ออกบิลแล้ว ${res.issued} ห้อง`);
      }
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>ออกบิลทุกห้อง</h2>
        </div>
        <form action={handleSubmit}>
          <div className="modal-body">
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              ออกบิลให้ทุกห้องที่มีผู้เช่ารายเดือนและยังไม่มีบิลของงวดนี้ ดึงมิเตอร์ที่ยังไม่ออกบิลมาคำนวณอัตโนมัติ
            </p>
            <div className="field">
              <label>งวดบิล (เดือน)</label>
              <input name="billingMonth" type="month" required defaultValue={month} />
            </div>
            {result && (
              <div style={{ marginTop: 12 }}>
                <p className="badge success">ออกบิลสำเร็จ {result.issued} ห้อง</p>
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
          <div className="modal-footer">
            <button type="button" className="secondary" onClick={onClose}>
              ปิด
            </button>
            {!result && (
              <button type="submit" disabled={pending}>
                {pending ? "กำลังออกบิล..." : "ออกบิลทั้งหมด"}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function IssueMoveInModal({ candidates, onClose, onDone }: { candidates: MoveInCandidate[]; onClose: () => void; onDone: (msg: string) => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      await issueMoveInBill(formData);
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>บิลแรกเข้า</h2>
        </div>
        <form action={handleSubmit}>
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}
            <div className="field">
              <label>สัญญา (เฉพาะที่ยังไม่เคยออกบิลแรกเข้า)</label>
              <select name="contractId" required>
                <option value="">-- เลือกสัญญา --</option>
                {candidates.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.room.roomNumber} — {c.tenant.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="secondary" onClick={onClose}>
              ยกเลิก
            </button>
            <button type="submit" disabled={pending}>
              ออกบิลแรกเข้า
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
