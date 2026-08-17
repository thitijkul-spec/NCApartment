"use client";

import { useState, useTransition } from "react";
import { createRoom, updateRoom, deleteRoomImage } from "./actions";
import { AMENITY_PRESETS, parseUtility, DEFAULT_METERED_UTILITY, DEFAULT_FLAT_UTILITY } from "@/lib/room-utils";
import type { UtilityMeteredConfig, UtilityFlatConfig, ExtraFee } from "@/lib/room-utils";
import type { RoomWithRelations, BuildingSettings } from "./types";
import { XIcon, TrashIcon, PlusIcon } from "../icons";

export default function RoomFormModal({
  room,
  settings,
  onClose,
  onSaved,
}: {
  room: RoomWithRelations | null;
  settings: BuildingSettings | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [rentalType, setRentalType] = useState(room?.rentalTypeSupport ?? "monthly");
  const [status, setStatus] = useState(room?.status ?? "available");
  const [amenities, setAmenities] = useState<string[]>(parseUtility(room?.amenities, [] as string[]));
  const [amenityInput, setAmenityInput] = useState("");
  const [extraFees, setExtraFees] = useState<ExtraFee[]>(parseUtility(room?.extraMonthlyFees, [] as ExtraFee[]));

  const water = parseUtility<UtilityMeteredConfig>(room?.utilityWater, DEFAULT_METERED_UTILITY);
  const electric = parseUtility<UtilityMeteredConfig>(room?.utilityElectric, DEFAULT_METERED_UTILITY);
  const internet = parseUtility<UtilityFlatConfig>(room?.utilityInternet, DEFAULT_FLAT_UTILITY);
  const commonArea = parseUtility<UtilityFlatConfig>(room?.utilityCommonArea, DEFAULT_FLAT_UTILITY);

  function toggleAmenity(tag: string) {
    setAmenities((prev) => (prev.includes(tag) ? prev.filter((a) => a !== tag) : [...prev, tag]));
  }

  function addCustomAmenity() {
    const v = amenityInput.trim();
    if (v && !amenities.includes(v)) setAmenities((prev) => [...prev, v]);
    setAmenityInput("");
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    amenities.forEach((a) => formData.append("amenities", a));
    if (room) formData.set("roomId", String(room.id));

    startTransition(async () => {
      const result = room ? await updateRoom(formData) : await createRoom(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        onSaved(room ? "บันทึกการแก้ไขห้องแล้ว" : "เพิ่มห้องพักแล้ว");
        onClose();
      }
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{room ? `แก้ไขห้อง ${room.roomNumber}` : "เพิ่มห้องพักใหม่"}</h2>
          <button className="modal-close" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        <form action={handleSubmit}>
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}

            <div className="form-row">
              <div className="field">
                <label>หมายเลขห้อง *</label>
                <input name="roomNumber" defaultValue={room?.roomNumber ?? ""} required />
              </div>
              <div className="field">
                <label>ชั้น *</label>
                <input name="floor" type="number" defaultValue={room?.floor ?? 1} required />
              </div>
              <div className="field">
                <label>ขนาด (ตร.ม.)</label>
                <input name="sizeSqm" type="number" step="0.01" defaultValue={room?.sizeSqm ?? ""} />
              </div>
              <div className="field">
                <label>สถานะ *</label>
                <select name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="available">ว่าง</option>
                  <option value="occupied" disabled={!room}>
                    มีผู้เช่า
                  </option>
                  <option value="reserved" disabled={!room}>
                    จองแล้ว
                  </option>
                  <option value="maintenance">ปิดปรับปรุง</option>
                </select>
              </div>
            </div>

            {status === "maintenance" && (
              <div className="field">
                <label>เหตุผลปิดปรับปรุง</label>
                <input name="maintenanceReason" defaultValue={room?.maintenanceReason ?? ""} />
              </div>
            )}

            <div className="field">
              <label>ประเภทการรองรับ *</label>
              <div style={{ display: "flex", gap: 16 }}>
                {[
                  ["monthly", "รายเดือน"],
                  ["daily", "รายวัน"],
                  ["both", "รายวัน+รายเดือน"],
                ].map(([v, label]) => (
                  <label key={v} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input
                      type="radio"
                      name="rentalTypeSupport"
                      value={v}
                      checked={rentalType === v}
                      onChange={() => setRentalType(v)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            <div className="form-row">
              {rentalType !== "daily" && (
                <div className="field">
                  <label>ราคารายเดือน (บาท)</label>
                  <input name="monthlyPrice" type="number" step="0.01" defaultValue={room?.monthlyPrice ?? ""} />
                </div>
              )}
              {rentalType !== "monthly" && (
                <div className="field">
                  <label>ราคารายวัน (บาท)</label>
                  <input name="dailyPrice" type="number" step="0.01" defaultValue={room?.dailyPrice ?? ""} />
                </div>
              )}
              {rentalType !== "daily" && (
                <div className="field">
                  <label>มัดจำรายเดือน (บาท)</label>
                  <input
                    name="monthlyDeposit"
                    type="number"
                    step="0.01"
                    placeholder="ใช้ค่าอาคาร"
                    defaultValue={room?.monthlyDeposit ?? ""}
                  />
                </div>
              )}
              {rentalType !== "monthly" && (
                <div className="field">
                  <label>มัดจำรายวัน (บาท)</label>
                  <input
                    name="dailyDeposit"
                    type="number"
                    step="0.01"
                    placeholder="ใช้ค่าอาคาร"
                    defaultValue={room?.dailyDeposit ?? ""}
                  />
                </div>
              )}
            </div>

            <h2 style={{ fontSize: 15, marginTop: 8 }}>ค่าสาธารณูปโภค</h2>
            <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: -8 }}>
              ค่าเริ่มต้นดึงจากการตั้งค่าอาคาร ปรับได้ตามต้องการ — ติ๊ก &quot;ไม่คิด&quot; จะไม่เก็บค่านี้เลยแม้ติ๊ก &quot;ใช้ตามอาคาร&quot; ไว้
            </p>
            <UtilityMeteredRow label="ค่าน้ำ" prefix="water" defaults={water} buildingRate={settings?.defaultWaterRate} buildingMode={settings?.defaultWaterMode} />
            <UtilityMeteredRow label="ค่าไฟ" prefix="electric" defaults={electric} buildingRate={settings?.defaultElectricRate} buildingMode={settings?.defaultElectricMode} />
            <UtilityFlatRow label="ค่าอินเทอร์เน็ต" prefix="internet" defaults={internet} buildingAmount={settings?.defaultInternetFee} />
            <UtilityFlatRow label="ค่าส่วนกลาง" prefix="commonArea" defaults={commonArea} buildingAmount={settings?.defaultCommonAreaFee} />

            <h2 style={{ fontSize: 15, marginTop: 16 }}>ค่าใช้จ่ายอื่นๆ รายเดือน (เฉพาะห้องนี้)</h2>
            {extraFees.map((f, i) => (
              <div key={i} className="form-row" style={{ alignItems: "center" }}>
                <input
                  name="extraFeeName"
                  defaultValue={f.name}
                  placeholder="ชื่อรายการ"
                  style={{ flex: 2, padding: 8, border: "1px solid var(--border)", borderRadius: 8 }}
                />
                <input
                  name="extraFeeAmount"
                  type="number"
                  defaultValue={f.amount}
                  placeholder="จำนวนเงิน"
                  style={{ flex: 1, padding: 8, border: "1px solid var(--border)", borderRadius: 8 }}
                />
                <button type="button" className="plain-icon-btn" onClick={() => setExtraFees((p) => p.filter((_, idx) => idx !== i))}>
                  <TrashIcon size={16} />
                </button>
              </div>
            ))}
            <button type="button" className="secondary" onClick={() => setExtraFees((p) => [...p, { name: "", amount: 0 }])}>
              <PlusIcon size={14} /> เพิ่มรายการ
            </button>

            <h2 style={{ fontSize: 15, marginTop: 16 }}>สิ่งอำนวยความสะดวก</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
              {AMENITY_PRESETS.map((tag) => (
                <button
                  type="button"
                  key={tag}
                  className={`tab${amenities.includes(tag) ? " active" : ""}`}
                  onClick={() => toggleAmenity(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={amenityInput}
                onChange={(e) => setAmenityInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCustomAmenity();
                  }
                }}
                placeholder="พิมพ์แล้วกด Enter เพื่อเพิ่มเอง"
                style={{ flex: 1, padding: 8, border: "1px solid var(--border)", borderRadius: 8 }}
              />
            </div>
            {amenities.filter((a) => !AMENITY_PRESETS.includes(a)).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {amenities
                  .filter((a) => !AMENITY_PRESETS.includes(a))
                  .map((tag) => (
                    <span key={tag} className="tab active" onClick={() => toggleAmenity(tag)} style={{ cursor: "pointer" }}>
                      {tag} ✕
                    </span>
                  ))}
              </div>
            )}

            <div className="field" style={{ marginTop: 16 }}>
              <label>รูปห้อง (สูงสุด 10 รูป, ไม่เกิน 10MB/รูป)</label>
              <input name="images" type="file" accept="image/*" multiple />
            </div>
            {room && room.images.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
                {room.images.map((img) => (
                  <label key={img.id} style={{ position: "relative", cursor: "pointer" }}>
                    <img src={img.url} alt="" style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 8 }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4, fontSize: 11 }}>
                      <input
                        type="radio"
                        name="coverImageId"
                        value={img.id}
                        defaultChecked={room.coverImageId === img.id}
                      />
                      รูปปก
                    </div>
                  </label>
                ))}
              </div>
            )}

            <div className="field" style={{ marginTop: 16 }}>
              <label>รายละเอียดเพิ่มเติม</label>
              <textarea name="notes" defaultValue={room?.notes ?? ""} rows={3} />
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="secondary" onClick={onClose}>
              ยกเลิก
            </button>
            <button type="submit" disabled={pending}>
              {pending ? "กำลังบันทึก..." : "บันทึก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UtilityMeteredRow({
  label,
  prefix,
  defaults,
  buildingRate,
  buildingMode,
}: {
  label: string;
  prefix: string;
  defaults: UtilityMeteredConfig;
  buildingRate?: number | null;
  buildingMode?: string | null;
}) {
  const [excluded, setExcluded] = useState(defaults.excluded);
  const [useDefault, setUseDefault] = useState(defaults.useBuildingDefault);
  const [mode, setMode] = useState(defaults.mode);

  return (
    <div className="form-row" style={{ alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
      <strong style={{ minWidth: 90 }}>{label}</strong>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
        <input type="checkbox" name={`${prefix}_excluded`} checked={excluded} onChange={(e) => setExcluded(e.target.checked)} />
        ไม่คิด
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, opacity: excluded ? 0.5 : 1 }}>
        <input
          type="checkbox"
          name={`${prefix}_useDefault`}
          checked={useDefault}
          disabled={excluded}
          onChange={(e) => setUseDefault(e.target.checked)}
        />
        ใช้ตามอาคาร {useDefault && !excluded && `(${buildingMode === "metered" ? "มิเตอร์" : "เหมาจ่าย"} ${buildingRate ?? "-"})`}
      </label>
      {!excluded && !useDefault && (
        <>
          <select name={`${prefix}_mode`} value={mode} onChange={(e) => setMode(e.target.value as any)}>
            <option value="flat">เหมาจ่าย</option>
            <option value="metered">อิงมิเตอร์ (บาท/หน่วย)</option>
          </select>
          <input name={`${prefix}_rate`} type="number" step="0.01" defaultValue={defaults.rate ?? ""} placeholder="อัตรา" style={{ width: 100 }} />
        </>
      )}
    </div>
  );
}

function UtilityFlatRow({
  label,
  prefix,
  defaults,
  buildingAmount,
}: {
  label: string;
  prefix: string;
  defaults: UtilityFlatConfig;
  buildingAmount?: number | null;
}) {
  const [excluded, setExcluded] = useState(defaults.excluded);
  const [useDefault, setUseDefault] = useState(defaults.useBuildingDefault);

  return (
    <div className="form-row" style={{ alignItems: "center", borderTop: "1px solid var(--border)", paddingTop: 10 }}>
      <strong style={{ minWidth: 90 }}>{label}</strong>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
        <input type="checkbox" name={`${prefix}_excluded`} checked={excluded} onChange={(e) => setExcluded(e.target.checked)} />
        ไม่คิด
      </label>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, opacity: excluded ? 0.5 : 1 }}>
        <input
          type="checkbox"
          name={`${prefix}_useDefault`}
          checked={useDefault}
          disabled={excluded}
          onChange={(e) => setUseDefault(e.target.checked)}
        />
        ใช้ตามอาคาร {useDefault && !excluded && `(${buildingAmount ?? "-"} บาท)`}
      </label>
      {!excluded && !useDefault && (
        <input name={`${prefix}_amount`} type="number" step="0.01" defaultValue={defaults.amount ?? ""} placeholder="บาท/เดือน" style={{ width: 100 }} />
      )}
    </div>
  );
}
