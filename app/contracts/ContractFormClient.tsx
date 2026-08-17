"use client";

import { useState, useTransition } from "react";
import { createContract, updateContract } from "./actions";
import type { Contract, ContractClauseTemplate, ContractClauseSelection, Room, Tenant, RoomOccupancy } from "@prisma/client";
import { PlusIcon, TrashIcon } from "../icons";

type ContractWithSelections = Contract & { clauseSelections: ContractClauseSelection[] };

export default function ContractFormClient({
  mode,
  contract,
  room,
  tenant,
  occupancy,
  clauseTemplates,
}: {
  mode: "new" | "edit";
  contract: ContractWithSelections | null;
  room: Room;
  tenant: Tenant;
  occupancy: RoomOccupancy | null;
  clauseTemplates: ContractClauseTemplate[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [noEndDate, setNoEndDate] = useState(contract?.noEndDate ?? false);
  const [isBilingual, setIsBilingual] = useState(contract?.isBilingual ?? false);
  const [requireWitness, setRequireWitness] = useState(contract?.requireWitness ?? false);
  const [witnessNames, setWitnessNames] = useState<string[]>(
    contract?.witnessNames ? JSON.parse(contract.witnessNames) : []
  );
  const [additionalRules, setAdditionalRules] = useState<string[]>(
    contract?.additionalRules ? JSON.parse(contract.additionalRules) : []
  );
  const selectedIds = new Set(contract?.clauseSelections.filter((s) => s.included).map((s) => s.clauseTemplateId));

  function handleSubmit(formData: FormData) {
    setError(null);
    if (contract) formData.set("contractId", String(contract.id));
    else {
      formData.set("roomId", String(room.id));
      formData.set("tenantId", String(tenant.id));
      if (occupancy) formData.set("occupancyId", String(occupancy.id));
    }
    additionalRules.forEach((r) => formData.append("additionalRule", r));
    witnessNames.forEach((w) => formData.append("witnessName", w));

    startTransition(async () => {
      const result = contract ? await updateContract(formData) : await createContract(formData);
      if (result?.error) setError(result.error);
    });
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="card">
      {error && <div className="form-error">{error}</div>}
      {contract?.signedAt && (
        <div className="form-error" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>
          สัญญานี้เซ็นแล้ว — บันทึกการแก้ไขจะล้างลายเซ็นเดิมทิ้ง ต้องเซ็นใหม่
        </div>
      )}
      <p style={{ fontSize: 14, color: "var(--text-muted)" }}>
        ผู้เช่า: <strong>{tenant.name}</strong> · ห้อง: <strong>{room.roomNumber}</strong>
      </p>

      <form action={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div className="form-row">
          <div className="field">
            <label>วันที่ทำสัญญา *</label>
            <input name="contractDate" type="date" required defaultValue={contract ? new Date(contract.contractDate).toISOString().slice(0, 10) : today} />
          </div>
          <div className="field">
            <label>วันเริ่มสัญญา *</label>
            <input name="startDate" type="date" required defaultValue={contract ? new Date(contract.startDate).toISOString().slice(0, 10) : today} />
          </div>
          <div className="field">
            <label>วันสิ้นสุดสัญญา</label>
            <input name="endDate" type="date" disabled={noEndDate} defaultValue={contract?.endDate ? new Date(contract.endDate).toISOString().slice(0, 10) : ""} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" name="noEndDate" checked={noEndDate} onChange={(e) => setNoEndDate(e.target.checked)} />
            ไม่มีกำหนดสิ้นสุด (ต่อเนื่อง)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" name="isBilingual" checked={isBilingual} onChange={(e) => setIsBilingual(e.target.checked)} />
            พิมพ์เอกสารสองภาษา (ไทย+อังกฤษ)
          </label>
        </div>

        <div className="form-row">
          <div className="field">
            <label>ค่าเช่า/เดือน (บาท) *</label>
            <input name="rentAmount" type="number" step="0.01" required defaultValue={contract?.rentAmount ?? room.monthlyPrice ?? ""} />
          </div>
          <div className="field">
            <label>เงินประกัน (บาท)</label>
            <input name="depositAmount" type="number" step="0.01" defaultValue={contract?.depositAmount ?? occupancy?.depositAmount ?? room.monthlyDeposit ?? ""} />
          </div>
          <div className="field">
            <label>วันกำหนดชำระ (ของทุกเดือน) *</label>
            <input name="paymentDueDay" type="number" min={1} max={31} required defaultValue={contract?.paymentDueDay ?? 1} />
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label>ค่าปรับล่าช้า (บาท/วัน)</label>
            <input name="lateFeePerDay" type="number" step="0.01" defaultValue={contract?.lateFeePerDay ?? ""} />
          </div>
          <div className="field">
            <label>เงินล่วงหน้า (บาท)</label>
            <input name="advanceRentAmount" type="number" step="0.01" defaultValue={contract?.advanceRentAmount ?? ""} />
          </div>
          <div className="field">
            <label>ค่าอุปกรณ์ไฟฟ้า (บาท/เดือน)</label>
            <input name="electricalEquipmentFee" type="number" step="0.01" defaultValue={contract?.electricalEquipmentFee ?? ""} />
          </div>
          <div className="field">
            <label>ค่าครุภัณฑ์/เฟอร์นิเจอร์ (บาท/เดือน)</label>
            <input name="furnitureEquipmentFee" type="number" step="0.01" defaultValue={contract?.furnitureEquipmentFee ?? ""} />
          </div>
        </div>

        <div className="form-row">
          <div className="field">
            <label>แจ้งล่วงหน้าก่อนเลิกสัญญา (วัน)</label>
            <input name="noticeDaysBeforeTerminate" type="number" defaultValue={contract?.noticeDaysBeforeTerminate ?? 30} />
          </div>
          <div className="field">
            <label>คืนเงินประกันภายใน (วัน)</label>
            <input name="depositReturnDays" type="number" defaultValue={contract?.depositReturnDays ?? 7} />
          </div>
          <div className="field">
            <label>ค้างชำระได้ไม่เกิน (วัน)</label>
            <input name="allowedOverdueDays" type="number" defaultValue={contract?.allowedOverdueDays ?? 7} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" name="allowPets" defaultChecked={contract?.allowPets ?? false} />
            อนุญาตให้เลี้ยงสัตว์
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" name="noSmoking" defaultChecked={contract?.noSmoking ?? true} />
            ห้ามสูบบุหรี่ในอาคาร
          </label>
        </div>

        <div>
          <label style={{ fontSize: 13, color: "var(--text-muted)" }}>กฎเพิ่มเติม (แนบท้ายสัญญา)</label>
          {additionalRules.map((r, i) => (
            <div className="form-row" key={i} style={{ marginTop: 6 }}>
              <input value={r} onChange={(e) => setAdditionalRules((p) => p.map((x, idx) => (idx === i ? e.target.value : x)))} style={{ flex: 1 }} />
              <button type="button" className="plain-icon-btn" onClick={() => setAdditionalRules((p) => p.filter((_, idx) => idx !== i))}>
                <TrashIcon size={16} />
              </button>
            </div>
          ))}
          <button type="button" className="secondary" style={{ marginTop: 6 }} onClick={() => setAdditionalRules((p) => [...p, ""])}>
            <PlusIcon size={14} /> เพิ่มกฎ
          </button>
        </div>

        <div>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" name="requireWitness" checked={requireWitness} onChange={(e) => setRequireWitness(e.target.checked)} />
            มีพยานในสัญญา
          </label>
          {requireWitness && (
            <div style={{ marginTop: 8 }}>
              {witnessNames.map((w, i) => (
                <div className="form-row" key={i} style={{ marginTop: 6 }}>
                  <input value={w} placeholder="ชื่อพยาน" onChange={(e) => setWitnessNames((p) => p.map((x, idx) => (idx === i ? e.target.value : x)))} />
                  <button type="button" className="plain-icon-btn" onClick={() => setWitnessNames((p) => p.filter((_, idx) => idx !== i))}>
                    <TrashIcon size={16} />
                  </button>
                </div>
              ))}
              {witnessNames.length < 4 && (
                <button type="button" className="secondary" style={{ marginTop: 6 }} onClick={() => setWitnessNames((p) => [...p, ""])}>
                  <PlusIcon size={14} /> เพิ่มพยาน
                </button>
              )}
            </div>
          )}
        </div>

        <h2 style={{ fontSize: 15 }}>ข้อสัญญาที่จะรวมในเอกสารนี้</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {clauseTemplates.map((t) => (
            <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                name="clauseTemplateId"
                value={t.id}
                defaultChecked={contract ? selectedIds.has(t.id) : t.isDefaultIncluded}
              />
              {t.order}. {t.title}
            </label>
          ))}
        </div>

        <div>
          <button type="submit" disabled={pending}>
            {pending ? "กำลังบันทึก..." : "บันทึกสัญญา"}
          </button>
        </div>
      </form>
    </div>
  );
}
