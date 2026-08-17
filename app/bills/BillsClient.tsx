"use client";

import { useMemo, useState, useTransition } from "react";
import type { Bill, BillLineItem, Payment, Room, Tenant, RoomOccupancy, Contract } from "@prisma/client";
import { issueSingleBill, issueBulkBills, issueMoveInBill } from "./actions";
import { WalletIcon, PlusIcon } from "../icons";

type BillRow = Bill & { room: Room; tenant: Tenant; lineItems: BillLineItem[]; payments: Payment[] };
type RoomOption = Room & { occupancies: (RoomOccupancy & { tenant: Tenant })[] };
type MoveInCandidate = Contract & { tenant: Tenant; room: Room };

function billBalance(b: BillRow) {
  const total = b.lineItems.reduce((s, li) => s + li.amount, 0) - (b.discountAmount ?? 0);
  const paid = b.payments.reduce((s, p) => s + p.amount, 0);
  return { total, paid, balance: total - paid };
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const STATUS_LABEL: Record<string, string> = {
  unpaid: "ค้างชำระ",
  partially_paid: "จ่ายบางส่วน",
  paid: "ชำระแล้ว",
  cancelled: "ยกเลิก",
};

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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "unpaid" | "partially_paid" | "paid" | "cancelled" | "overdue">("all");
  const [showMenu, setShowMenu] = useState(false);
  const [showSingle, setShowSingle] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showMoveIn, setShowMoveIn] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  const filtered = useMemo(() => {
    return bills.filter((b) => {
      const overdue = b.status !== "paid" && b.status !== "cancelled" && new Date(b.dueDate).getTime() < Date.now();
      if (statusFilter === "overdue" && !overdue) return false;
      if (statusFilter !== "all" && statusFilter !== "overdue" && b.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!b.billNo.toLowerCase().includes(q) && !b.tenant.name.toLowerCase().includes(q) && !b.room.roomNumber.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [bills, statusFilter, search]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header-title">
            <WalletIcon size={24} /> การเงิน — บิล/ใบเสร็จ
          </div>
          <p className="page-header-subtitle">{buildingName}</p>
        </div>
        <div className="page-header-actions">
          <a href="/bills/receipts" className="secondary btn">
            รายการใบเสร็จ
          </a>
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

      <input placeholder="ค้นหาเลขบิล, ชื่อผู้เช่า, เลขห้อง..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 12, minWidth: 280 }} />
      <div className="tabs">
        {(["all", "unpaid", "partially_paid", "paid", "overdue", "cancelled"] as const).map((s) => (
          <button key={s} className={`tab${statusFilter === s ? " active" : ""}`} onClick={() => setStatusFilter(s)}>
            {s === "all" ? "ทั้งหมด" : s === "overdue" ? "เลยกำหนด" : STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <table>
        <thead>
          <tr>
            <th>เลขบิล</th>
            <th>ห้อง</th>
            <th>ผู้เช่า</th>
            <th>งวด</th>
            <th>ครบกำหนด</th>
            <th>ยอดรวม</th>
            <th>คงเหลือ</th>
            <th>สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((b) => {
            const { total, balance } = billBalance(b);
            const overdue = b.status !== "paid" && b.status !== "cancelled" && new Date(b.dueDate).getTime() < Date.now();
            return (
              <tr key={b.id} style={{ cursor: "pointer" }} onClick={() => (window.location.href = `/bills/${b.id}`)}>
                <td>{b.billNo}</td>
                <td>{b.room.roomNumber}</td>
                <td>{b.tenant.name}</td>
                <td>{b.billingMonth}</td>
                <td>
                  {new Date(b.dueDate).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" })}
                  {overdue && <span className="badge danger" style={{ marginLeft: 6 }}>เลยกำหนด</span>}
                </td>
                <td>฿{total.toLocaleString()}</td>
                <td>฿{balance.toLocaleString()}</td>
                <td>
                  <span className={`badge ${b.status === "paid" ? "success" : b.status === "cancelled" ? "neutral" : overdue ? "danger" : "warning"}`}>
                    {STATUS_LABEL[b.status]}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {filtered.length === 0 && <p className="empty">ไม่พบบิลตามเงื่อนไขนี้</p>}

      {showSingle && <IssueSingleModal rooms={rooms} onClose={() => setShowSingle(false)} onDone={notify} />}
      {showBulk && <IssueBulkModal onClose={() => setShowBulk(false)} onDone={notify} />}
      {showMoveIn && <IssueMoveInModal candidates={moveInCandidates} onClose={() => setShowMoveIn(false)} onDone={notify} />}
    </div>
  );
}

function IssueSingleModal({ rooms, onClose, onDone }: { rooms: RoomOption[]; onClose: () => void; onDone: (msg: string) => void }) {
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
              <input name="billingMonth" type="month" required defaultValue={currentMonthKey()} />
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

function IssueBulkModal({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
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
              <input name="billingMonth" type="month" required defaultValue={currentMonthKey()} />
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
