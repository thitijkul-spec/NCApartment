"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { checkInTenant } from "./checkin-actions";
import type { TenantOption } from "./types";
import { PlusIcon, TrashIcon } from "../icons";
import { ROOM_STATUS_LABEL } from "@/lib/room-utils";
import { formatNumber } from "@/lib/format";

export type CheckInRoomLike = {
  id: number;
  roomNumber: string;
  rentalTypeSupport: string;
  monthlyPrice: number | null;
  dailyPrice: number | null;
  monthlyDeposit: number | null;
  dailyDeposit: number | null;
};

export type CheckInRoomOption = CheckInRoomLike & { floor: number; status: string };

export default function CheckInForm({
  room,
  roomOptions,
  tenants,
  prefillBooking,
  forceReservation = false,
  defaultTenantType,
  onDone,
  onCancel,
}: {
  room?: CheckInRoomLike;
  roomOptions?: CheckInRoomOption[];
  tenants: TenantOption[];
  prefillBooking?: { id: number; tenantId: number | null; bookingType: string; checkinDate: Date | string };
  forceReservation?: boolean;
  defaultTenantType?: string;
  onDone: (msg: string, occupancyId?: number) => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"existing" | "new">(prefillBooking?.tenantId ? "existing" : "new");
  const [search, setSearch] = useState("");
  const [existingTenantId, setExistingTenantId] = useState<number | null>(prefillBooking?.tenantId ?? null);
  const [selectedRoomId, setSelectedRoomId] = useState<number | "">(room?.id ?? "");
  const activeRoom: CheckInRoomLike | null = room ?? roomOptions?.find((r) => r.id === selectedRoomId) ?? null;
  const [tenantType, setTenantType] = useState(
    prefillBooking?.bookingType ??
      defaultTenantType ??
      (activeRoom ? (activeRoom.rentalTypeSupport === "both" ? "monthly" : activeRoom.rentalTypeSupport) : "monthly")
  );
  const [isReservation, setIsReservation] = useState(forceReservation);
  const [nights, setNights] = useState<number | "">("");
  const [checkinDate, setCheckinDate] = useState(
    prefillBooking ? new Date(prefillBooking.checkinDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)
  );
  const [checkoutDate, setCheckoutDate] = useState("");
  const [months, setMonths] = useState<number | "">("");
  const [plannedCheckoutDate, setPlannedCheckoutDate] = useState("");
  const [vehicles, setVehicles] = useState<{ plateNo: string; brandModel: string; color: string }[]>([]);

  const filteredTenants = useMemo(
    () => tenants.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())),
    [tenants, search]
  );

  // เมื่อเลือกห้องที่รองรับแค่ประเภทเดียว ให้ปรับ tenantType ให้ตรงอัตโนมัติ
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

  function onMonthsChange(n: string) {
    setMonths(n === "" ? "" : Number(n));
    if (n !== "" && checkinDate) {
      const d = new Date(checkinDate);
      d.setMonth(d.getMonth() + Number(n));
      setPlannedCheckoutDate(d.toISOString().slice(0, 10));
    } else {
      setPlannedCheckoutDate("");
    }
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    if (roomOptions && !activeRoom) {
      setError("กรุณาเลือกห้อง");
      return;
    }
    formData.set("mode", mode);
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
    if (isReservation) formData.set("isReservation", "on");
    if (prefillBooking) formData.set("bookingId", String(prefillBooking.id));

    startTransition(async () => {
      const result = await checkInTenant(formData);
      if (result?.error) setError(result.error);
      else onDone(isReservation ? "บันทึกการจองแล้ว" : "เพิ่มผู้เช่าเรียบร้อยแล้ว", result?.occupancyId);
    });
  }

  return (
    <form action={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <input type="hidden" name="roomId" value={activeRoom?.id ?? ""} />
      {error && <div className="form-error">{error}</div>}

      {roomOptions && (
        <div className="field">
          <label>เลือกห้อง *</label>
          <select value={selectedRoomId} onChange={(e) => setSelectedRoomId(Number(e.target.value))}>
            <option value="">-- เลือกห้อง --</option>
            {roomOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.roomNumber} (ชั้น {r.floor} · {ROOM_STATUS_LABEL[r.status]})
              </option>
            ))}
          </select>
        </div>
      )}

      {!prefillBooking && (
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button type="button" className={`tab${mode === "existing" ? " active" : ""}`} onClick={() => setMode("existing")}>
            เลือกจากผู้เช่าที่มีอยู่
          </button>
          <button type="button" className={`tab${mode === "new" ? " active" : ""}`} onClick={() => setMode("new")}>
            สร้างผู้เช่าใหม่
          </button>
        </div>
      )}

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
          <div className="field">
            <label>หมายเหตุ</label>
            <textarea name="note" rows={2} maxLength={2000} />
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

      <hr style={{ border: "none", borderTop: "1px solid var(--border)" }} />
      <strong>ข้อมูลการเข้าพัก</strong>

      {(!activeRoom || activeRoom.rentalTypeSupport === "both") && (
        <div className="field">
          <label>ประเภทการเข้าพัก</label>
          <div style={{ display: "flex", gap: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="radio" checked={tenantType === "monthly"} onChange={() => setTenantType("monthly")} /> รายเดือน
              {activeRoom?.monthlyPrice != null && ` (฿${formatNumber(activeRoom.monthlyPrice)})`}
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <input type="radio" checked={tenantType === "daily"} onChange={() => setTenantType("daily")} /> รายวัน
              {activeRoom?.dailyPrice != null && ` (฿${formatNumber(activeRoom.dailyPrice)})`}
            </label>
          </div>
        </div>
      )}
      <input type="hidden" name="tenantType" value={tenantType} />

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
        ) : isReservation ? (
          <div className="field">
            <label>กำหนดเซ็นสัญญาภายในวันที่ (ถ้ามี)</label>
            <input name="contractDeadlineDate" type="date" />
          </div>
        ) : (
          <>
            <div className="field">
              <label>จำนวนเดือน (เว้นว่าง = ไม่กำหนด)</label>
              <input type="number" min={1} value={months} onChange={(e) => onMonthsChange(e.target.value)} />
            </div>
            <div className="field">
              <label>วันสิ้นสุด</label>
              <input
                name="plannedCheckoutDate"
                type="date"
                value={plannedCheckoutDate}
                onChange={(e) => setPlannedCheckoutDate(e.target.value)}
              />
            </div>
          </>
        )}
        {!isReservation && (
          <div className="field">
            <label>เงินมัดจำ (บาท)</label>
            <input
              key={`deposit-${activeRoom?.id ?? "none"}-${tenantType}`}
              name="depositAmount"
              type="number"
              step="0.01"
              defaultValue={(tenantType === "monthly" ? activeRoom?.monthlyDeposit : activeRoom?.dailyDeposit) ?? ""}
            />
          </div>
        )}
      </div>

      {!isReservation && (
        <div className="form-row">
          <div className="field">
            <label>มิเตอร์น้ำเริ่มต้น (ไม่บังคับ)</label>
            <input name="initialWater" type="number" step="0.01" />
          </div>
          <div className="field">
            <label>มิเตอร์ไฟเริ่มต้น (ไม่บังคับ)</label>
            <input name="initialElectric" type="number" step="0.01" />
          </div>
        </div>
      )}

      {!forceReservation && (
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input type="checkbox" checked={isReservation} onChange={(e) => setIsReservation(e.target.checked)} />
          เป็นการจองล่วงหน้า (ยังไม่เข้าพักจริงตอนนี้)
        </label>
      )}

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        <button type="button" className="secondary" onClick={onCancel}>
          ยกเลิก
        </button>
        <button type="submit" disabled={pending}>
          {pending ? "กำลังบันทึก..." : isReservation ? "บันทึกการจอง" : "บันทึกและเพิ่มเข้าห้อง"}
        </button>
      </div>
    </form>
  );
}
