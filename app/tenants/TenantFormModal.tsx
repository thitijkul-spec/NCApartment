"use client";

import { useRef, useState, useTransition } from "react";
import { createTenant, updateTenant } from "./actions";
import type { TenantWithRelations } from "./types";
import { XIcon, PlusIcon, TrashIcon } from "../icons";

export default function TenantFormModal({
  tenant,
  onClose,
  onSaved,
}: {
  tenant: TenantWithRelations | null;
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [vehicles, setVehicles] = useState(
    tenant?.vehicles.map((v) => ({ plateNo: v.plateNo ?? "", brandModel: v.brandModel ?? "", color: v.color ?? "" })) ?? []
  );
  const [noteLen, setNoteLen] = useState(tenant?.note?.length ?? 0);
  const pendingFormRef = useRef<FormData | null>(null);

  function submit(formData: FormData, confirmDuplicate: boolean) {
    setError(null);
    if (tenant) formData.set("tenantId", String(tenant.id));
    if (confirmDuplicate) formData.set("confirmDuplicate", "on");
    vehicles.forEach((v) => {
      formData.append("vehiclePlateNo", v.plateNo);
      formData.append("vehicleBrandModel", v.brandModel);
      formData.append("vehicleColor", v.color);
    });

    startTransition(async () => {
      const result = tenant ? await updateTenant(formData) : await createTenant(formData);
      if (result?.warning) {
        setWarning(result.warning);
        pendingFormRef.current = formData;
      } else if (result?.error) {
        setError(result.error);
      } else {
        onSaved(tenant ? "บันทึกการแก้ไขแล้ว" : "เพิ่มผู้เช่าแล้ว");
        onClose();
      }
    });
  }

  function confirmAnyway() {
    const formData = pendingFormRef.current;
    setWarning(null);
    if (formData) submit(formData, true);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{tenant ? "แก้ไขข้อมูลผู้เช่า" : "เพิ่มผู้เช่าใหม่"}</h2>
          <button className="modal-close" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        <form action={(fd) => submit(fd, false)}>
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}
            {warning && (
              <div className="form-error" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>
                {warning}
                <div style={{ marginTop: 8 }}>
                  <button type="button" onClick={confirmAnyway} style={{ marginRight: 8 }}>
                    ยืนยันบันทึกต่อ
                  </button>
                  <button type="button" className="secondary" onClick={() => setWarning(null)}>
                    แก้ไขข้อมูล
                  </button>
                </div>
              </div>
            )}

            <div className="field">
              <label>รูปบัตรประชาชน (JPG/PNG ≤10MB)</label>
              <input name="idCardImage" type="file" accept="image/*" />
              {tenant?.idCardImageUrl && <img src={tenant.idCardImageUrl} alt="" style={{ height: 60, marginTop: 8, borderRadius: 8 }} />}
            </div>

            <div className="form-row">
              <div className="field" style={{ flex: 2 }}>
                <label>ชื่อ-นามสกุล *</label>
                <input name="name" defaultValue={tenant?.name ?? ""} required />
              </div>
              <div className="field">
                <label>เบอร์โทรศัพท์</label>
                <input name="phone" defaultValue={tenant?.phone ?? ""} />
              </div>
              <div className="field">
                <label>ประเภทผู้เช่า</label>
                <select name="tenantType" defaultValue={tenant?.tenantType ?? "monthly"}>
                  <option value="monthly">รายเดือน</option>
                  <option value="daily">รายวัน</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="field">
                <label>เพศ</label>
                <select name="gender" defaultValue={tenant?.gender ?? ""}>
                  <option value="">-</option>
                  <option value="male">ชาย</option>
                  <option value="female">หญิง</option>
                </select>
              </div>
              <div className="field">
                <label>อายุ</label>
                <input name="age" type="number" defaultValue={tenant?.age ?? ""} />
              </div>
              <div className="field">
                <label>LINE ID</label>
                <input name="lineId" defaultValue={tenant?.lineId ?? ""} />
              </div>
              <div className="field">
                <label>เลขบัตรประชาชน</label>
                <input name="idCardNo" defaultValue={tenant?.idCardNo ?? ""} />
              </div>
            </div>

            <div className="form-row">
              <div className="field" style={{ flex: 1 }}>
                <label>อีเมล</label>
                <input name="email" type="email" defaultValue={tenant?.email ?? ""} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>ชื่อผู้ติดต่อฉุกเฉิน</label>
                <input name="emergencyContactName" defaultValue={tenant?.emergencyContactName ?? ""} />
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>เบอร์ติดต่อฉุกเฉิน</label>
                <input name="emergencyContactPhone" defaultValue={tenant?.emergencyContactPhone ?? ""} />
              </div>
            </div>

            <div className="field">
              <label>ที่อยู่เดิม</label>
              <textarea name="previousAddress" defaultValue={tenant?.previousAddress ?? ""} rows={2} />
            </div>

            <div className="field">
              <label>ภาษาบิลที่ส่งทาง LINE</label>
              <select name="billLanguage" defaultValue={tenant?.billLanguage ?? "th"}>
                <option value="th">ไทย</option>
                <option value="en">อังกฤษ</option>
              </select>
            </div>

            <div className="field">
              <label>LINE User ID (ผูกด้วยมือ — ยังไม่มีบัญชี LINE OA)</label>
              <input name="lineUserId" defaultValue={tenant?.lineUserId ?? ""} />
            </div>

            <div className="field">
              <label>หมายเหตุ ({noteLen}/2000)</label>
              <textarea
                name="note"
                defaultValue={tenant?.note ?? ""}
                rows={3}
                maxLength={2000}
                onChange={(e) => setNoteLen(e.target.value.length)}
              />
            </div>

            <div>
              <label style={{ fontSize: 13, color: "var(--text-muted)" }}>ยานพาหนะ</label>
              {vehicles.map((v, i) => (
                <div className="form-row" key={i} style={{ marginTop: 6 }}>
                  <input placeholder="ทะเบียน" value={v.plateNo} onChange={(e) => setVehicles((p) => p.map((x, idx) => (idx === i ? { ...x, plateNo: e.target.value } : x)))} />
                  <input placeholder="ยี่ห้อ/รุ่น" value={v.brandModel} onChange={(e) => setVehicles((p) => p.map((x, idx) => (idx === i ? { ...x, brandModel: e.target.value } : x)))} />
                  <input placeholder="สี" value={v.color} onChange={(e) => setVehicles((p) => p.map((x, idx) => (idx === i ? { ...x, color: e.target.value } : x)))} />
                  <button type="button" className="plain-icon-btn" onClick={() => setVehicles((p) => p.filter((_, idx) => idx !== i))}>
                    <TrashIcon size={16} />
                  </button>
                </div>
              ))}
              <button type="button" className="secondary" style={{ marginTop: 6 }} onClick={() => setVehicles((p) => [...p, { plateNo: "", brandModel: "", color: "" }])}>
                <PlusIcon size={14} /> เพิ่มยานพาหนะ
              </button>
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
