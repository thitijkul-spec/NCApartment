"use client";

import { useMemo, useState, useTransition } from "react";
import type { BookingWithRelations, BookingRoomOption } from "./types";
import type { TenantOption } from "../rooms/types";
import type { Account } from "@prisma/client";
import { cancelBooking, archiveBooking, addBookingPayment, deleteBookingPayment, confirmBooking, assignBookingRoom } from "./actions";
import { checkInFromBooking } from "../rooms/checkin-actions";
import BookingFormModal from "./BookingFormModal";
import { CalendarIcon, PlusIcon, TrashIcon } from "../icons";
import { formatNumber } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  pending: "รอยืนยัน",
  confirmed: "ยืนยันแล้ว",
  cancelled: "ยกเลิก",
  completed: "เสร็จสิ้น",
  archived: "เก็บแล้ว",
};
const STATUS_BADGE: Record<string, string> = {
  pending: "warning",
  confirmed: "success",
  cancelled: "danger",
  completed: "neutral",
  archived: "neutral",
};

import { formatDateBE } from "@/lib/date-utils";

function fmtDate(d: Date | string | null | undefined) {
  return formatDateBE(d);
}

type FilterChip = "all" | "pending" | "confirmed" | "cancelled" | "completed" | "archived";

export default function BookingsClient({
  bookings,
  rooms,
  accounts,
  tenants,
  buildingName,
}: {
  bookings: BookingWithRelations[];
  rooms: BookingRoomOption[];
  accounts: Account[];
  tenants: TenantOption[];
  buildingName: string;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterChip>("all");
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [cancelTarget, setCancelTarget] = useState<BookingWithRelations | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      const effectiveStatus = b.archivedAt ? "archived" : b.status;
      if (filter === "all" && effectiveStatus === "archived") return false;
      if (filter !== "all" && effectiveStatus !== filter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (
          !b.bookingCode.toLowerCase().includes(q) &&
          !(b.tenant?.name ?? "").toLowerCase().includes(q) &&
          !(b.tenant?.phone ?? "").includes(q) &&
          !(b.room?.roomNumber ?? "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [bookings, filter, search]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header-title">
            <CalendarIcon size={24} /> จองห้องพัก
          </div>
          <p className="page-header-subtitle">รายการจองล่วงหน้าของ {buildingName}</p>
        </div>
        <div className="page-header-actions">
          <button onClick={() => setShowCreate(true)}>
            <PlusIcon size={16} /> จองห้องพัก
          </button>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      <input
        placeholder="ค้นหารหัสจอง, ชื่อผู้เช่า, เบอร์โทร, เลขห้อง..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 12, minWidth: 300 }}
      />
      <div className="tabs">
        {(Object.keys(STATUS_LABEL) as FilterChip[]).map((s) => (
          <button key={s} className={`tab${filter === s ? " active" : ""}`} onClick={() => setFilter(s)}>
            {STATUS_LABEL[s]}
          </button>
        ))}
        <button className={`tab${filter === "all" ? " active" : ""}`} onClick={() => setFilter("all")}>
          ทั้งหมด
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>รหัสจอง</th>
            <th>ห้อง</th>
            <th>ผู้เช่า</th>
            <th>ประเภท</th>
            <th>วันเข้าพัก</th>
            <th>มัดจำ</th>
            <th>สถานะ</th>
            <th>การดำเนินการ</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((b) => {
            const overdue =
              b.bookingType === "monthly" &&
              b.contractDeadlineDate &&
              new Date(b.contractDeadlineDate).getTime() < Date.now() &&
              (b.status === "pending" || b.status === "confirmed");
            return (
              <BookingRow
                key={b.id}
                booking={b}
                accounts={accounts}
                rooms={rooms}
                overdue={!!overdue}
                expanded={expandedId === b.id}
                onToggleExpand={() => setExpandedId(expandedId === b.id ? null : b.id)}
                onNotify={notify}
                onCancelClick={() => setCancelTarget(b)}
              />
            );
          })}
        </tbody>
      </table>
      {filtered.length === 0 && <p className="empty">ไม่พบรายการจองตามเงื่อนไขนี้</p>}

      {showCreate && (
        <BookingFormModal rooms={rooms} tenants={tenants} accounts={accounts} onClose={() => setShowCreate(false)} onSaved={notify} />
      )}
      {cancelTarget && (
        <CancelBookingModal booking={cancelTarget} onClose={() => setCancelTarget(null)} onDone={notify} />
      )}
    </div>
  );
}

function BookingRow({
  booking,
  accounts,
  rooms,
  overdue,
  expanded,
  onToggleExpand,
  onNotify,
  onCancelClick,
}: {
  booking: BookingWithRelations;
  accounts: Account[];
  rooms: BookingRoomOption[];
  overdue: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onNotify: (msg: string) => void;
  onCancelClick: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [pickRoomId, setPickRoomId] = useState<number | "">("");
  const effectiveStatus = booking.archivedAt ? "archived" : booking.status;

  function doArchive() {
    const formData = new FormData();
    formData.set("bookingId", String(booking.id));
    startTransition(async () => {
      await archiveBooking(formData);
      onNotify("เก็บรายการแล้ว");
    });
  }

  function doConfirm() {
    const formData = new FormData();
    formData.set("bookingId", String(booking.id));
    startTransition(async () => {
      const result = await confirmBooking(formData);
      if (result?.error) alert(result.error);
      else onNotify("ยืนยันการจองแล้ว");
    });
  }

  function doAssignRoom() {
    if (!pickRoomId) return;
    const formData = new FormData();
    formData.set("bookingId", String(booking.id));
    formData.set("roomId", String(pickRoomId));
    startTransition(async () => {
      const result = await assignBookingRoom(formData);
      if (result?.error) alert(result.error);
      else onNotify("บันทึกห้องให้รายการจองแล้ว");
    });
  }

  function doCheckIn() {
    const formData = new FormData();
    formData.set("bookingId", String(booking.id));
    startTransition(async () => {
      const result = await checkInFromBooking(formData);
      if (result?.error) alert(result.error);
      else onNotify("เช็คอินเรียบร้อยแล้ว");
    });
  }

  return (
    <>
      <tr style={{ cursor: "pointer" }} onClick={onToggleExpand}>
        <td>{booking.bookingCode}</td>
        <td onClick={(e) => e.stopPropagation()}>
          {booking.room ? (
            booking.room.roomNumber
          ) : (
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <select
                value={pickRoomId}
                onChange={(e) => setPickRoomId(e.target.value ? Number(e.target.value) : "")}
                style={{ fontSize: 12, padding: "2px 4px" }}
              >
                <option value="">-- เลือกห้อง --</option>
                {rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.roomNumber}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="secondary"
                style={{ fontSize: 12, padding: "2px 8px" }}
                onClick={doAssignRoom}
                disabled={!pickRoomId || pending}
              >
                บันทึก
              </button>
            </div>
          )}
        </td>
        <td>{booking.tenant?.name ?? "-"}</td>
        <td>{booking.bookingType === "monthly" ? "รายเดือน" : "รายวัน"}</td>
        <td>
          {fmtDate(booking.checkinDate)}
          {overdue && (
            <span className="badge danger" style={{ marginLeft: 6 }}>
              เลยกำหนดทำสัญญา
            </span>
          )}
        </td>
        <td>฿{formatNumber(booking.payments.reduce((s, p) => s + p.amount, 0))}</td>
        <td>
          <span className={`badge ${STATUS_BADGE[effectiveStatus]}`}>{STATUS_LABEL[effectiveStatus]}</span>
        </td>
        <td onClick={(e) => e.stopPropagation()}>
          <div className="status-buttons">
            {booking.status === "pending" && (
              <button className="secondary" onClick={doConfirm} disabled={pending}>
                ยืนยันจอง
              </button>
            )}
            {(booking.status === "pending" || booking.status === "confirmed") && (
              <>
                <button onClick={doCheckIn} disabled={pending}>
                  เช็คอิน
                </button>
                <button className="danger" onClick={onCancelClick} disabled={pending}>
                  ยกเลิก
                </button>
              </>
            )}
            {(booking.status === "completed" || booking.status === "cancelled") && !booking.archivedAt && (
              <button className="secondary" onClick={doArchive} disabled={pending}>
                เก็บ
              </button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} style={{ background: "var(--surface-2)" }}>
            <BookingPayments booking={booking} accounts={accounts} onNotify={onNotify} />
            {booking.note && <p style={{ fontSize: 13, marginTop: 8 }}>หมายเหตุ: {booking.note}</p>}
            {booking.cancelReason && <p style={{ fontSize: 13, color: "var(--danger)" }}>เหตุผลยกเลิก: {booking.cancelReason}</p>}
          </td>
        </tr>
      )}
    </>
  );
}

function BookingPayments({
  booking,
  accounts,
  onNotify,
}: {
  booking: BookingWithRelations;
  accounts: Account[];
  onNotify: (msg: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [method, setMethod] = useState("cash");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const canEdit = booking.status === "pending" || booking.status === "confirmed";

  function handleAdd() {
    const formData = new FormData();
    formData.set("bookingId", String(booking.id));
    formData.set("method", method);
    formData.set("amount", amount);
    if (accountId) formData.set("accountId", accountId);
    startTransition(async () => {
      const result = await addBookingPayment(formData);
      if (result?.error) alert(result.error);
      else {
        setAmount("");
        onNotify("บันทึกการชำระแล้ว");
      }
    });
  }

  function handleDelete(paymentId: number) {
    const formData = new FormData();
    formData.set("paymentId", String(paymentId));
    startTransition(async () => {
      await deleteBookingPayment(formData);
      onNotify("ลบรายการชำระแล้ว");
    });
  }

  return (
    <div style={{ padding: 12 }}>
      <strong style={{ fontSize: 13 }}>เงินมัดจำที่รับแล้ว</strong>
      <table style={{ marginTop: 8 }}>
        <thead>
          <tr>
            <th>วิธี</th>
            <th>บัญชี</th>
            <th>จำนวนเงิน</th>
            {canEdit && <th></th>}
          </tr>
        </thead>
        <tbody>
          {booking.payments.map((p) => (
            <tr key={p.id}>
              <td>{p.method === "cash" ? "เงินสด" : "โอนเงิน"}</td>
              <td>{p.account?.name ?? "-"}</td>
              <td>฿{formatNumber(p.amount)}</td>
              {canEdit && (
                <td>
                  <button className="plain-icon-btn" onClick={() => handleDelete(p.id)} disabled={pending}>
                    <TrashIcon size={14} />
                  </button>
                </td>
              )}
            </tr>
          ))}
          {booking.payments.length === 0 && (
            <tr>
              <td colSpan={4} className="empty">
                ยังไม่มีการชำระ
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {canEdit && (
        <div className="form-row" style={{ marginTop: 10, alignItems: "flex-end" }}>
          <div className="field">
            <label>วิธี</label>
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">เงินสด</option>
              <option value="transfer">โอนเงิน</option>
            </select>
          </div>
          {method === "transfer" && (
            <div className="field">
              <label>บัญชี</label>
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                <option value="">-- เลือกบัญชี --</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="field">
            <label>จำนวนเงิน</label>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <button type="button" className="secondary" onClick={handleAdd} disabled={pending}>
            บันทึกการชำระ
          </button>
        </div>
      )}
    </div>
  );
}

function CancelBookingModal({
  booking,
  onClose,
  onDone,
}: {
  booking: BookingWithRelations;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(formData: FormData) {
    formData.set("bookingId", String(booking.id));
    startTransition(async () => {
      const result = await cancelBooking(formData);
      if (result?.error) setError(result.error);
      else {
        onDone("ยกเลิกการจองแล้ว");
        onClose();
      }
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>ยกเลิกการจอง {booking.bookingCode}</h2>
        </div>
        <form action={handleSubmit}>
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}
            <div className="field">
              <label>เหตุผล (ถ้ามี)</label>
              <textarea name="cancelReason" rows={2} />
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" name="depositRefunded" />
              คืนเงินมัดจำให้ผู้เช่า
            </label>
          </div>
          <div className="modal-footer">
            <button type="button" className="secondary" onClick={onClose}>
              ปิด
            </button>
            <button type="submit" className="danger" disabled={pending}>
              ยืนยันยกเลิกการจอง
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
