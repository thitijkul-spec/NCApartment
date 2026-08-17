"use client";

import { useState, useTransition } from "react";
import type { RoomWithRelations, TenantOption } from "./types";
import { deleteRoom } from "./actions";
import { checkoutTenant, cancelBookingFromRoom } from "./checkin-actions";
import CheckInForm from "./CheckInForm";
import {
  ROOM_STATUS_LABEL,
  ROOM_STATUS_BADGE_CLASS,
  rentalTypeLabel,
  parseUtility,
  DEFAULT_METERED_UTILITY,
  DEFAULT_FLAT_UTILITY,
} from "@/lib/room-utils";
import { XIcon, PersonIcon, CalendarIcon, GaugeIcon, WrenchIcon, WalletIcon, DoorIcon } from "../icons";

const TABS = ["ข้อมูลห้อง", "ผู้เช่า", "สัญญา", "มิเตอร์", "แจ้งซ่อม", "การชำระ"] as const;

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

function billBalance(bill: RoomWithRelations["bills"][number]) {
  const total = bill.lineItems.reduce((s, li) => s + li.amount, 0) - (bill.discountAmount ?? 0);
  const paid = bill.payments.reduce((s, p) => s + p.amount, 0);
  return { total, paid, balance: total - paid };
}

export default function RoomDetailModal({
  room,
  tenants,
  onClose,
  onChanged,
  onEdit,
  initialTab = "ข้อมูลห้อง",
}: {
  room: RoomWithRelations;
  tenants: TenantOption[];
  onClose: () => void;
  onChanged: (msg: string) => void;
  onEdit: () => void;
  initialTab?: (typeof TABS)[number];
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>(initialTab);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  const activeOccupancy = room.occupancies.find((o) => o.status === "active");
  const activeBooking = room.bookings.find((b) => b.status === "pending" || b.status === "confirmed");
  const latestContract = room.contracts[0];

  function handleDelete() {
    if (!confirm(`ยืนยันการลบห้อง ${room.roomNumber}?`)) return;
    const formData = new FormData();
    formData.set("roomId", String(room.id));
    startTransition(async () => {
      const result = await deleteRoom(formData);
      if (result?.error) setError(result.error);
      else {
        onChanged("ลบห้องแล้ว");
        onClose();
      }
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>
              <DoorIcon size={18} /> ห้อง {room.roomNumber}{" "}
              <span className={`badge ${ROOM_STATUS_BADGE_CLASS[room.status]}`}>{ROOM_STATUS_LABEL[room.status]}</span>
            </h2>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
              ชั้น {room.floor} · ฿{room.monthlyPrice ?? "-"}/เดือน · ฿{room.dailyPrice ?? "-"}/วัน
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="secondary" onClick={onEdit}>
              แก้ไข
            </button>
            <button className="danger" onClick={handleDelete} disabled={pending}>
              ลบ
            </button>
            <button className="modal-close" onClick={onClose}>
              <XIcon size={18} />
            </button>
          </div>
        </div>

        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}
          <div className="modal-tabs">
            {TABS.map((t) => (
              <button key={t} className={`modal-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>

          {tab === "ข้อมูลห้อง" && <RoomInfoTab room={room} />}

          {tab === "ผู้เช่า" && (
            <div>
              {activeOccupancy ? (
                <div className="card" style={{ marginBottom: 0 }}>
                  <h2>
                    <PersonIcon size={16} /> {activeOccupancy.tenant.name}
                  </h2>
                  <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                    โทร {activeOccupancy.tenant.phone ?? "-"} · เข้าพัก {fmtDate(activeOccupancy.checkinDate)} ·{" "}
                    {activeOccupancy.tenant.tenantType === "monthly" ? "รายเดือน" : "รายวัน"}
                    {activeOccupancy.plannedCheckoutDate && ` · สิ้นสุด ${fmtDate(activeOccupancy.plannedCheckoutDate)}`}
                  </p>
                  <p style={{ fontSize: 14 }}>เงินมัดจำ: ฿{activeOccupancy.depositAmount ?? 0}</p>
                  {!showCheckout ? (
                    <button className="secondary" onClick={() => setShowCheckout(true)}>
                      เช็คเอาท์
                    </button>
                  ) : (
                    <CheckoutForm
                      occupancyId={activeOccupancy.id}
                      onDone={(msg) => {
                        onChanged(msg);
                        setShowCheckout(false);
                      }}
                      onCancel={() => setShowCheckout(false)}
                    />
                  )}
                </div>
              ) : activeBooking ? (
                <div className="card" style={{ marginBottom: 0 }}>
                  <h2>
                    <CalendarIcon size={16} /> จองแล้ว — {activeBooking.tenant?.name ?? "-"}
                  </h2>
                  <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
                    วันเข้าพัก {fmtDate(activeBooking.checkinDate)} · รหัสจอง {activeBooking.bookingCode}
                  </p>
                  {!showCheckIn ? (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => setShowCheckIn(true)}>เช็คอิน</button>
                      <CancelBookingButton bookingId={activeBooking.id} onDone={onChanged} />
                    </div>
                  ) : (
                    <CheckInForm
                      room={room}
                      tenants={tenants}
                      prefillBooking={activeBooking}
                      onDone={(msg) => {
                        onChanged(msg);
                        setShowCheckIn(false);
                      }}
                      onCancel={() => setShowCheckIn(false)}
                    />
                  )}
                </div>
              ) : (
                <div>
                  {!showCheckIn ? (
                    <div className="empty" style={{ textAlign: "center", padding: 32 }}>
                      <PersonIcon size={32} />
                      <p>ยังไม่มีผู้เช่าในห้องนี้</p>
                      <button onClick={() => setShowCheckIn(true)}>+ เพิ่มผู้เช่า</button>
                    </div>
                  ) : (
                    <CheckInForm
                      room={room}
                      tenants={tenants}
                      onDone={(msg) => {
                        onChanged(msg);
                        setShowCheckIn(false);
                      }}
                      onCancel={() => setShowCheckIn(false)}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {tab === "สัญญา" && (
            <div>
              {room.contracts.length === 0 && <p className="empty">ยังไม่มีสัญญาสำหรับห้องนี้</p>}
              {room.contracts.map((c) => (
                <div key={c.id} className="card" style={{ marginBottom: 12 }}>
                  <strong>{c.tenant.name}</strong>
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {fmtDate(c.startDate)} — {c.noEndDate ? "ไม่มีกำหนด" : fmtDate(c.endDate)} · ฿{c.rentAmount}/เดือน ·{" "}
                    {c.signedAt ? "เซ็นแล้ว" : "ยังไม่เซ็น"}
                  </p>
                  <a href={`/contracts/${c.id}`} className="secondary btn">
                    เปิดสัญญา
                  </a>
                </div>
              ))}
              {activeOccupancy && (
                <a href={`/contracts/new?occupancyId=${activeOccupancy.id}`} className="btn">
                  + สร้างสัญญา
                </a>
              )}
            </div>
          )}

          {tab === "มิเตอร์" && (
            <div>
              {room.meterReadings.length === 0 && <p className="empty">ยังไม่มีข้อมูลมิเตอร์</p>}
              <table>
                <thead>
                  <tr>
                    <th>เดือน</th>
                    <th>น้ำ (ก่อน→ปัจจุบัน)</th>
                    <th>ไฟ (ก่อน→ปัจจุบัน)</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {room.meterReadings.map((m) => (
                    <tr key={m.id}>
                      <td>{m.readingMonth}</td>
                      <td>
                        {m.waterPrev} → {m.waterCurrent} ({m.waterUnits})
                      </td>
                      <td>
                        {m.electricPrev} → {m.electricCurrent} ({m.electricUnits})
                      </td>
                      <td>
                        <span className={`badge ${m.billingStatus === "billed" ? "success" : "neutral"}`}>
                          {m.billingStatus === "billed" ? "ออกบิลแล้ว" : "ยังไม่ออกบิล"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <a href={`/meters?roomId=${room.id}`} className="secondary btn" style={{ marginTop: 12 }}>
                จดมิเตอร์
              </a>
            </div>
          )}

          {tab === "แจ้งซ่อม" && (
            <div>
              {room.repairRequests.length === 0 && <p className="empty">ยังไม่มีรายการแจ้งซ่อม</p>}
              {room.repairRequests.map((r) => (
                <div key={r.id} className="card" style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <strong>{r.title}</strong>
                    <span className={`badge ${r.status === "completed" ? "success" : r.status === "in_progress" ? "warning" : "neutral"}`}>
                      {r.status === "completed" ? "เสร็จสิ้น" : r.status === "in_progress" ? "กำลังดำเนินการ" : "รอดำเนินการ"}
                    </span>
                  </div>
                  <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {r.categoryName} · {r.assignedTechnician?.name ?? "ยังไม่มอบหมาย"}
                  </p>
                </div>
              ))}
              <a href={`/repairs?roomId=${room.id}`} className="btn">
                + แจ้งซ่อม
              </a>
            </div>
          )}

          {tab === "การชำระ" && (
            <div>
              {room.bills.length === 0 && <p className="empty">ยังไม่มีบิลสำหรับห้องนี้</p>}
              <table>
                <thead>
                  <tr>
                    <th>เลขบิล</th>
                    <th>งวด</th>
                    <th>ยอดรวม</th>
                    <th>ชำระแล้ว</th>
                    <th>คงเหลือ</th>
                    <th>สถานะ</th>
                  </tr>
                </thead>
                <tbody>
                  {room.bills.map((b) => {
                    const { total, paid, balance } = billBalance(b);
                    return (
                      <tr key={b.id}>
                        <td>{b.billNo}</td>
                        <td>{b.billingMonth}</td>
                        <td>{total.toLocaleString()}</td>
                        <td>{paid.toLocaleString()}</td>
                        <td>{balance.toLocaleString()}</td>
                        <td>
                          <span className={`badge ${b.status}`}>{b.status}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <a href={`/bills?roomId=${room.id}`} className="secondary btn" style={{ marginTop: 12 }}>
                ไปหน้าบิล
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RoomInfoTab({ room }: { room: RoomWithRelations }) {
  const water = parseUtility(room.utilityWater, DEFAULT_METERED_UTILITY);
  const electric = parseUtility(room.utilityElectric, DEFAULT_METERED_UTILITY);
  const internet = parseUtility(room.utilityInternet, DEFAULT_FLAT_UTILITY);
  const commonArea = parseUtility(room.utilityCommonArea, DEFAULT_FLAT_UTILITY);
  const amenities = parseUtility<string[]>(room.amenities, []);

  function describeMetered(u: typeof water) {
    if (u.excluded) return "ไม่คิด";
    if (u.useBuildingDefault) return "ใช้ตามอาคาร";
    return u.mode === "metered" ? `อิงมิเตอร์ ${u.rate ?? "-"} บาท/หน่วย` : `เหมาจ่าย ${u.rate ?? "-"} บาท`;
  }
  function describeFlat(u: typeof internet) {
    if (u.excluded) return "ไม่คิด";
    if (u.useBuildingDefault) return "ใช้ตามอาคาร";
    return `${u.amount ?? "-"} บาท/เดือน`;
  }

  return (
    <div>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="label">รองรับ</div>
          <div className="value" style={{ fontSize: 18 }}>
            {rentalTypeLabel(room.rentalTypeSupport)}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">ขนาดห้อง</div>
          <div className="value" style={{ fontSize: 18 }}>
            {room.sizeSqm ? `${room.sizeSqm} ตร.ม.` : "-"}
          </div>
        </div>
        <div className="stat-card">
          <div className="label">มัดจำ</div>
          <div className="value" style={{ fontSize: 18 }}>
            ฿{room.monthlyDeposit ?? "-"} / ฿{room.dailyDeposit ?? "-"}
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: 15 }}>การคิดค่าสาธารณูปโภค</h2>
      <table>
        <tbody>
          <tr>
            <td>ค่าน้ำ</td>
            <td>{describeMetered(water)}</td>
          </tr>
          <tr>
            <td>ค่าไฟ</td>
            <td>{describeMetered(electric)}</td>
          </tr>
          <tr>
            <td>ค่าอินเทอร์เน็ต</td>
            <td>{describeFlat(internet)}</td>
          </tr>
          <tr>
            <td>ค่าส่วนกลาง</td>
            <td>{describeFlat(commonArea)}</td>
          </tr>
        </tbody>
      </table>

      {amenities.length > 0 && (
        <>
          <h2 style={{ fontSize: 15, marginTop: 16 }}>สิ่งอำนวยความสะดวก</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {amenities.map((a) => (
              <span key={a} className="tab">
                {a}
              </span>
            ))}
          </div>
        </>
      )}

      {room.images.length > 0 && (
        <>
          <h2 style={{ fontSize: 15, marginTop: 16 }}>รูปห้อง</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {room.images.map((img) => (
              <img key={img.id} src={img.url} alt="" style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 8 }} />
            ))}
          </div>
        </>
      )}

      {room.notes && (
        <>
          <h2 style={{ fontSize: 15, marginTop: 16 }}>รายละเอียดเพิ่มเติม</h2>
          <p style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{room.notes}</p>
        </>
      )}
    </div>
  );
}

function CheckoutForm({ occupancyId, onDone, onCancel }: { occupancyId: number; onDone: (msg: string) => void; onCancel: () => void }) {
  const [pending, startTransition] = useTransition();
  async function handleSubmit(formData: FormData) {
    formData.set("occupancyId", String(occupancyId));
    startTransition(async () => {
      const result = await checkoutTenant(formData);
      if (!result?.error) onDone("เช็คเอาท์เรียบร้อยแล้ว");
    });
  }
  return (
    <form action={handleSubmit} style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
        การคำนวณคืนเงินมัดจำและปิดยอดค่าน้ำ-ไฟทำที่โมดูลการเงิน — ขั้นตอนนี้แค่ปิดสถานะการเข้าพัก
      </p>
      <div className="form-row">
        <div className="field">
          <label>วันย้ายออก</label>
          <input name="movedOutDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>เหตุผล (ถ้ามี)</label>
          <input name="movedOutReason" />
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="secondary" onClick={onCancel}>
          ยกเลิก
        </button>
        <button type="submit" disabled={pending}>
          ยืนยันเช็คเอาท์
        </button>
      </div>
    </form>
  );
}

function CancelBookingButton({ bookingId, onDone }: { bookingId: number; onDone: (msg: string) => void }) {
  const [pending, startTransition] = useTransition();
  function handleClick() {
    const reason = prompt("เหตุผลการยกเลิก (ถ้ามี)") ?? "";
    const formData = new FormData();
    formData.set("bookingId", String(bookingId));
    formData.set("cancelReason", reason);
    startTransition(async () => {
      const result = await cancelBookingFromRoom(formData);
      if (result?.error) alert(result.error);
      else onDone("ยกเลิกการจองแล้ว");
    });
  }
  return (
    <button type="button" className="secondary" onClick={handleClick} disabled={pending}>
      ยกเลิกการจอง
    </button>
  );
}
