"use client";

import { useState, useTransition } from "react";
import { createParcel, updateParcel } from "./actions";
import { DELIVERY_COMPANIES } from "./types";
import type { ParcelWithRelations } from "./types";
import type { Tenant } from "@prisma/client";
import { XIcon } from "../icons";

function toLocalDateTimeInput(d: Date | string) {
  const date = new Date(d);
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

export default function ParcelFormModal({
  parcel,
  tenants,
  onClose,
  onSaved,
}: {
  parcel: ParcelWithRelations | null;
  tenants: Tenant[];
  onClose: () => void;
  onSaved: (msg: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tenantSearch, setTenantSearch] = useState("");
  const [tenantId, setTenantId] = useState<number | "">(parcel?.tenantId ?? "");
  const [company, setCompany] = useState(parcel?.deliveryCompany ?? "");

  const filteredTenants = tenants.filter((t) => t.name.toLowerCase().includes(tenantSearch.toLowerCase()));

  function submit(formData: FormData) {
    setError(null);
    if (parcel) formData.set("parcelId", String(parcel.id));
    formData.set("tenantId", tenantId ? String(tenantId) : "");
    formData.set("deliveryCompany", company);

    startTransition(async () => {
      const result = parcel ? await updateParcel(formData) : await createParcel(formData);
      if (result?.error) setError(result.error);
      else {
        onSaved(parcel ? "บันทึกการแก้ไขแล้ว" : "บันทึกพัสดุแล้ว");
        onClose();
      }
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{parcel ? "แก้ไขพัสดุ" : "บันทึกพัสดุที่มาส่ง"}</h2>
          <button className="modal-close" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        <form action={submit}>
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}

            <div className="field">
              <label>รูปใบนำส่ง (ไม่บังคับ)</label>
              <input name="photo" type="file" accept="image/*" />
              {parcel?.photoUrl && <img src={parcel.photoUrl} alt="" style={{ height: 60, marginTop: 8, borderRadius: 8 }} />}
            </div>

            <div className="field">
              <label>ชื่อผู้รับ *</label>
              <input name="recipientName" defaultValue={parcel?.recipientName ?? ""} required />
            </div>

            <div className="field">
              <label>โยงกับผู้เช่า (ไม่บังคับ)</label>
              <input placeholder="ค้นหาชื่อผู้เช่า..." value={tenantSearch} onChange={(e) => setTenantSearch(e.target.value)} />
              <select value={tenantId} onChange={(e) => setTenantId(e.target.value ? Number(e.target.value) : "")} size={4} style={{ marginTop: 6 }}>
                <option value="">-- ไม่โยงผู้เช่า --</option>
                {filteredTenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.phone ? `(${t.phone})` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>วันที่และเวลาที่มาส่ง *</label>
              <input name="receivedAt" type="datetime-local" required defaultValue={parcel ? toLocalDateTimeInput(parcel.receivedAt) : toLocalDateTimeInput(new Date())} />
            </div>

            <div className="field">
              <label>บริษัทขนส่ง</label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                {DELIVERY_COMPANIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`tab${company === c ? " active" : ""}`}
                    style={{ padding: "4px 10px", fontSize: 12 }}
                    onClick={() => setCompany(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="หรือพิมพ์เอง" />
            </div>

            <div className="field">
              <label>เลขพัสดุ</label>
              <input name="trackingNo" defaultValue={parcel?.trackingNo ?? ""} />
            </div>

            <div className="field">
              <label>หมายเหตุ</label>
              <textarea name="notes" defaultValue={parcel?.notes ?? ""} rows={2} />
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
