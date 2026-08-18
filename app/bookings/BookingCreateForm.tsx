"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import type { Account } from "@prisma/client";
import { checkInTenant } from "../rooms/checkin-actions";
import type { TenantOption } from "../rooms/types";
import type { BookingRoomOption } from "./types";
import { PlusIcon, TrashIcon } from "../icons";
import { formatNumber } from "@/lib/format";

type PaymentRow = { method: string; accountId: string; amount: string };

export default function BookingCreateForm({
  rooms,
  tenants,
  accounts,
  onDone,
  onCancel,
}: {
  rooms: BookingRoomOption[];
  tenants: TenantOption[];
  accounts: Account[];
  onDone: (msg: string) => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // 1) ข้อมูลการเข้าพัก
  const [selectedRoomId, setSelectedRoomId] = useState<number | "">("");
  const activeRoom = rooms.find((r) => r.id === selectedRoomId) ?? null;
  const [tenantType, setTenantType] = useState("daily"); // ลูกค้ารายวันจองเยอะกว่า จึงตั้งค่าเริ่มต้นเป็นรายวัน
  const [checkinDate, setCheckinDate] = useState(new Date().toISOString().slice(0, 10));
  const [nights, setNights] = useState<number | "">("");
  const [checkoutDate, setCheckoutDate] = useState("");

  useEffect(() => {
    if (activeRoom && activeRoom.rentalTypeSupport !== "both" && tenantType !== activeRoom.rentalTypeSupport) {
      setTenantType(activeRoom.rentalTypeSupport);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoom?.id]);

  function onNightsChange(n: string) {
    setNights(n === "" ? "" : Number(n));
    if (n !== "" && checkinDate) {
      const d = new Date(checkinDate);
      d.setDate(d.getDate() + Number(n));
      setCheckoutDate(d.toISOString().slice(0, 10));
    }
  }

  // 2) การชำระเงิน — ไม่บังคับ จองเปล่าได้ 0 บาท จ่ายตอนไหนก็ได้
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const totalPaid = useMemo(() => payments.reduce((s, p) => s + (Number(p.amount) || 0), 0), [payments]);

  function addPaymentRow() {
    setPayments((p) => [...p, { method: "cash", accountId: "", amount: "" }]);
  }
  function updatePaymentRow(i: number, patch: Partial<PaymentRow>) {
    setPayments((p) => p.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function removePaymentRow(i: number) {
    setPayments((p) => p.filter((_, idx) => idx !== i));
  }

  // 3) รายละเอียดผู้จอง
  const [mode, setMode] = useState<"existing" | "new">("new");
  const [search, setSearch] = useState("");
  const [existingTenantId, setExistingTenantId] = useState<number | null>(null);
  const [vehicles, setVehicles] = useState<{ plateNo: string; brandModel: string; color: string }[]>([]);

  const filteredTenants = useMemo(
    () => tenants.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())),
    [tenants, search]
  );

  async function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("isReservation", "on");
    formData.set("mode", mode);
    formData.set("tenantType", tenantType);
    if (activeRoom) formData.set("roomId", String(activeRoom.id));
    if (mode === "existing") {
      if (!existingTenantId) {
        setError("กรุณาเลือกผู้เช่า");
        return;
      }
      formData.set("existingTenantId", String(existingTenantId));
    }
    vehicles.forEach((v) => {
      formData.append("vehiclePlateNo", v.plateNo);
      formData.append("vehicleBrandModel", v.brandModel);
      formData.append("vehicleColor", v.color);
    });
    payments
      .filter((p) => Number(p.amount) > 0)
      .forEach((p) => {
        formData.append("paymentMethod", p.method);
        formData.append("paymentAccountId", p.accountId);
        formData.append("paymentAmount", p.amount);
      });

    startTransition(async () => {
      const result = await checkInTenant(formData);
      if (result?.error) setError(result.error);
      else onDone("บันทึกการจองแล้ว");
    });
  }

  return (
    <form action={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {error && <div className="form-error">{error}</div>}

      <strong>1. ข้อมูลการเข้าพัก</strong>
      <div className="field">
        <label>เลือกห้อง (ยังไม่เลือกก็ได้ ถ้ายังไม่รู้ว่าห้องไหนว่าง)</label>
        <select value={selectedRoomId} onChange={(e) => setSelectedRoomId(e.target.value ? Number(e.target.value) : "")}>
          <option value="">-- ยังไม่เลือกห้อง --</option>
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.roomNumber} (ชั้น {r.floor})
            </option>
          ))}
        </select>
      </div>

      {(!activeRoom || activeRoom.rentalTypeSupport === "both") && (
        <div className="field">
          <label>ประเภทการเข้าพัก</label>
          <div style={{ display: "flex", gap: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="radio" checked={tenantType === "daily"} onChange={() => setTenantType("daily")} /> รายวัน
              {activeRoom?.dailyPrice != null && ` (฿${formatNumber(activeRoom.dailyPrice)})`}
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="radio" checked={tenantType === "monthly"} onChange={() => setTenantType("monthly")} /> รายเดือน
              {activeRoom?.monthlyPrice != null && ` (฿${formatNumber(activeRoom.monthlyPrice)})`}
            </label>
          </div>
        </div>
      )}

      <div className="form-row">
        <div className="field">
          <label>วันเข้าพัก *</label>
          <input name="checkinDate" type="date" required value={checkinDate} onChange={(e) => setCheckinDate(e.target.value)} />
        </div>
        {tenantType === "daily" ? (
          <>
            <div className="field">
              <label>จำนวนคืน</label>
              <input type="number" min={1} value={nights} onChange={(e) => onNightsChange(e.target.value)} />
            </div>
            <div className="field">
              <label>วันออก</label>
              <input name="checkoutDate" type="date" value={checkoutDate} onChange={(e) => setCheckoutDate(e.target.value)} />
            </div>
          </>
        ) : (
          <div className="field">
            <label>กำหนดเซ็นสัญญาภายในวันที่ (ถ้ามี)</label>
            <input name="contractDeadlineDate" type="date" />
          </div>
        )}
      </div>

      <div className="field">
        <label>หมายเหตุ</label>
        <textarea name="note" rows={2} maxLength={2000} />
      </div>

      <hr style={{ border: "none", borderTop: "1px solid var(--border)" }} />
      <strong>2. การชำระเงิน (ไม่บังคับ — จองเปล่าไว้ก่อนแล้วค่อยจ่ายทีหลังก็ได้)</strong>
      {payments.map((p, i) => (
        <div className="form-row" key={i} style={{ alignItems: "center" }}>
          <select
            value={p.method}
            onChange={(e) => updatePaymentRow(i, { method: e.target.value })}
            style={{ maxWidth: 140 }}
          >
            <option value="cash">เงินสด</option>
            <option value="transfer">โอนเงิน</option>
          </select>
          {p.method === "transfer" && (
            <select value={p.accountId} onChange={(e) => updatePaymentRow(i, { accountId: e.target.value })} style={{ maxWidth: 180 }}>
              <option value="">-- เลือกบัญชี --</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          )}
          <input
            type="number"
            step="0.01"
            placeholder="จำนวนเงิน"
            value={p.amount}
            onChange={(e) => updatePaymentRow(i, { amount: e.target.value })}
            style={{ maxWidth: 140 }}
          />
          <button type="button" className="plain-icon-btn" onClick={() => removePaymentRow(i)}>
            <TrashIcon size={16} />
          </button>
        </div>
      ))}
      <button type="button" className="secondary" style={{ alignSelf: "flex-start" }} onClick={addPaymentRow}>
        <PlusIcon size={14} /> เพิ่มรายการชำระ
      </button>
      {payments.length > 0 && <p style={{ fontSize: 13, color: "var(--text-muted)" }}>รวมรับแล้ว: ฿{formatNumber(totalPaid)}</p>}

      <hr style={{ border: "none", borderTop: "1px solid var(--border)" }} />
      <strong>3. รายละเอียดผู้จอง</strong>

      <div className="tabs" style={{ marginBottom: 0 }}>
        <button type="button" className={`tab${mode === "existing" ? " active" : ""}`} onClick={() => setMode("existing")}>
          เลือกจากผู้เช่าที่มีอยู่
        </button>
        <button type="button" className={`tab${mode === "new" ? " active" : ""}`} onClick={() => setMode("new")}>
          สร้างผู้เช่าใหม่
        </button>
      </div>

      {mode === "existing" ? (
        <div className="field">
          <label>ค้นหาผู้เช่า (ชื่อ)</label>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="พิมพ์ชื่อผู้เช่า..." />
          <select
            size={Math.min(6, Math.max(3, filteredTenants.length))}
            value={existingTenantId ?? ""}
            onChange={(e) => setExistingTenantId(Number(e.target.value))}
            style={{ marginTop: 8 }}
          >
            {filteredTenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} {t.phone ? `(${t.phone})` : ""}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <>
          <div className="field">
            <label>รูปบัตรประชาชน</label>
            <input name="idCardImage" type="file" accept="image/*" />
          </div>
          <div className="form-row">
            <div className="field" style={{ flex: 2 }}>
              <label>ชื่อ-นามสกุล *</label>
              <input name="name" required />
            </div>
            <div className="field">
              <label>เบอร์โทรศัพท์</label>
              <input name="phone" />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label>เพศ</label>
              <select name="gender" defaultValue="">
                <option value="">-</option>
                <option value="male">ชาย</option>
                <option value="female">หญิง</option>
              </select>
            </div>
            <div className="field">
              <label>อายุ</label>
              <input name="age" type="number" />
            </div>
            <div className="field">
              <label>LINE ID</label>
              <input name="lineId" />
            </div>
            <div className="field">
              <label>เลขบัตรประชาชน</label>
              <input name="idCardNo" />
            </div>
          </div>
          <div className="form-row">
            <div className="field" style={{ flex: 1 }}>
              <label>อีเมล</label>
              <input name="email" type="email" />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>เบอร์ติดต่อฉุกเฉิน</label>
              <input name="emergencyContactPhone" />
            </div>
          </div>
          <div className="field">
            <label>ที่อยู่เดิม</label>
            <textarea name="previousAddress" rows={2} />
          </div>
          <div className="field">
            <label>ภาษาบิลที่ส่งทาง LINE</label>
            <select name="billLanguage" defaultValue="th">
              <option value="th">ไทย</option>
              <option value="en">อังกฤษ</option>
            </select>
          </div>

          <div>
            <label style={{ fontSize: 13, color: "var(--text-muted)" }}>ยานพาหนะ</label>
            {vehicles.map((v, i) => (
              <div className="form-row" key={i} style={{ marginTop: 6 }}>
                <input
                  placeholder="ทะเบียน"
                  value={v.plateNo}
                  onChange={(e) => setVehicles((p) => p.map((x, idx) => (idx === i ? { ...x, plateNo: e.target.value } : x)))}
                />
                <input
                  placeholder="ยี่ห้อ/รุ่น"
                  value={v.brandModel}
                  onChange={(e) => setVehicles((p) => p.map((x, idx) => (idx === i ? { ...x, brandModel: e.target.value } : x)))}
                />
                <input
                  placeholder="สี"
                  value={v.color}
                  onChange={(e) => setVehicles((p) => p.map((x, idx) => (idx === i ? { ...x, color: e.target.value } : x)))}
                />
                <button type="button" className="plain-icon-btn" onClick={() => setVehicles((p) => p.filter((_, idx) => idx !== i))}>
                  <TrashIcon size={16} />
                </button>
              </div>
            ))}
            <button type="button" className="secondary" style={{ marginTop: 6 }} onClick={() => setVehicles((p) => [...p, { plateNo: "", brandModel: "", color: "" }])}>
              <PlusIcon size={14} /> เพิ่มยานพาหนะ
            </button>
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="secondary" onClick={onCancel}>
          ยกเลิก
        </button>
        <button type="submit" disabled={pending}>
          {pending ? "กำลังบันทึก..." : "บันทึกการจอง"}
        </button>
      </div>
    </form>
  );
}
