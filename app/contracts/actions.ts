"use server";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { saveBase64Image } from "@/lib/upload";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function readContractFields(formData: FormData) {
  const additionalRules = formData
    .getAll("additionalRule")
    .map(String)
    .filter((s) => s.trim());
  const witnessNames = formData
    .getAll("witnessName")
    .map(String)
    .filter((s) => s.trim())
    .slice(0, 4);

  return {
    contractDate: new Date(String(formData.get("contractDate"))),
    startDate: new Date(String(formData.get("startDate"))),
    endDate: formData.get("noEndDate") === "on" || !formData.get("endDate") ? null : new Date(String(formData.get("endDate"))),
    noEndDate: formData.get("noEndDate") === "on",
    isBilingual: formData.get("isBilingual") === "on",
    rentAmount: Number(formData.get("rentAmount")) || 0,
    depositAmount: Number(formData.get("depositAmount")) || 0,
    paymentDueDay: Number(formData.get("paymentDueDay")) || 1,
    lateFeePerDay: formData.get("lateFeePerDay") ? Number(formData.get("lateFeePerDay")) : null,
    advanceRentAmount: formData.get("advanceRentAmount") ? Number(formData.get("advanceRentAmount")) : null,
    electricalEquipmentFee: formData.get("electricalEquipmentFee") ? Number(formData.get("electricalEquipmentFee")) : null,
    furnitureEquipmentFee: formData.get("furnitureEquipmentFee") ? Number(formData.get("furnitureEquipmentFee")) : null,
    noticeDaysBeforeTerminate: Number(formData.get("noticeDaysBeforeTerminate")) || 30,
    depositReturnDays: Number(formData.get("depositReturnDays")) || 7,
    allowedOverdueDays: Number(formData.get("allowedOverdueDays")) || 7,
    allowPets: formData.get("allowPets") === "on",
    noSmoking: formData.get("noSmoking") === "on",
    additionalRules: additionalRules.length ? JSON.stringify(additionalRules) : null,
    requireWitness: formData.get("requireWitness") === "on",
    witnessNames: witnessNames.length ? JSON.stringify(witnessNames) : null,
  };
}

export async function createContract(formData: FormData) {
  const { building } = await requireAccess("tenant");

  const roomId = Number(formData.get("roomId"));
  const tenantId = Number(formData.get("tenantId"));
  const occupancyId = formData.get("occupancyId") ? Number(formData.get("occupancyId")) : null;
  if (!roomId || !tenantId) return { error: "กรุณาเลือกห้องและผู้เช่า" };

  const payee = await prisma.buildingPayeeSettings.findUnique({ where: { buildingId: building.id } });
  const templates = await prisma.contractClauseTemplate.findMany({ where: { buildingId: building.id } });
  const selectedTemplateIds = new Set(formData.getAll("clauseTemplateId").map(Number));

  const contract = await prisma.contract.create({
    data: {
      buildingId: building.id,
      occupancyId,
      tenantId,
      roomId,
      headerTextSnapshot: payee?.headerTextTemplate ?? null,
      payeeNameSnapshot: payee?.payeeName ?? null,
      payeeIdCardNoSnapshot: payee?.payeeIdCardNo ?? null,
      payeePhoneSnapshot: payee?.payeePhone ?? null,
      payeeAddressSnapshot: payee?.payeeAddress ?? null,
      ...readContractFields(formData),
      clauseSelections: {
        create: templates.map((t) => ({ clauseTemplateId: t.id, included: selectedTemplateIds.has(t.id) })),
      },
    },
  });

  revalidatePath("/contracts");
  redirect(`/contracts/${contract.id}`);
}

export async function updateContract(formData: FormData) {
  const { building } = await requireAccess("tenant");
  const id = Number(formData.get("contractId"));
  const existing = await prisma.contract.findFirst({ where: { id, buildingId: building.id } });
  if (!existing) return { error: "ไม่พบสัญญา" };

  const templates = await prisma.contractClauseTemplate.findMany({ where: { buildingId: building.id } });
  const selectedTemplateIds = new Set(formData.getAll("clauseTemplateId").map(Number));
  const wasSigned = !!existing.signedAt;

  await prisma.$transaction([
    prisma.contractClauseSelection.deleteMany({ where: { contractId: id } }),
    prisma.contract.update({
      where: { id },
      data: {
        ...readContractFields(formData),
        ...(wasSigned ? { ownerSignatureImage: null, signedAt: null } : {}),
        clauseSelections: {
          create: templates.map((t) => ({ clauseTemplateId: t.id, included: selectedTemplateIds.has(t.id) })),
        },
      },
    }),
  ]);

  revalidatePath("/contracts");
  redirect(`/contracts/${id}`);
}

export async function saveSignature(formData: FormData) {
  const { building } = await requireAccess("tenant");
  const id = Number(formData.get("contractId"));
  const existing = await prisma.contract.findFirst({ where: { id, buildingId: building.id } });
  if (!existing) return { error: "ไม่พบสัญญา" };

  const dataUrl = String(formData.get("signatureData") || "");
  const url = await saveBase64Image(dataUrl, "signatures");
  if (!url) return { error: "ลายเซ็นไม่ถูกต้อง กรุณาลองใหม่" };

  await prisma.contract.update({ where: { id }, data: { ownerSignatureImage: url, signedAt: new Date() } });
  revalidatePath(`/contracts/${id}`);
}

export async function deleteContract(formData: FormData) {
  const { building } = await requireAccess("tenant");
  const id = Number(formData.get("contractId"));
  const contract = await prisma.contract.findFirst({ where: { id, buildingId: building.id } });
  if (!contract) return { error: "ไม่พบสัญญา" };

  if (contract.signedAt) {
    await prisma.contract.update({ where: { id }, data: { archivedAt: new Date() } });
  } else {
    try {
      await prisma.$transaction([
        prisma.contractClauseSelection.deleteMany({ where: { contractId: id } }),
        prisma.contract.delete({ where: { id } }),
      ]);
    } catch {
      return { error: "ลบไม่ได้ — มีบิลหรือข้อมูลอื่นผูกกับสัญญานี้อยู่แล้ว" };
    }
  }

  revalidatePath("/contracts");
  redirect("/contracts");
}
