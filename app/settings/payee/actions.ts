"use server";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { saveUploadedFile } from "@/lib/upload";
import { revalidatePath } from "next/cache";

export async function updatePayeeSettings(formData: FormData) {
  const { building } = await requireAccess("setting");

  const existing = await prisma.buildingPayeeSettings.findUnique({ where: { buildingId: building.id } });

  const logoUrl = (await saveUploadedFile(formData.get("logo") as File | null, "payee")) ?? existing?.logoUrl ?? null;
  const signatureImageUrl =
    (await saveUploadedFile(formData.get("signature") as File | null, "payee")) ??
    existing?.signatureImageUrl ??
    null;

  const data = {
    headerTextTemplate: String(formData.get("headerTextTemplate") || "").trim() || null,
    payeeName: String(formData.get("payeeName") || "").trim() || null,
    payeeIdCardNo: String(formData.get("payeeIdCardNo") || "").trim() || null,
    payeePhone: String(formData.get("payeePhone") || "").trim() || null,
    payeeAddress: String(formData.get("payeeAddress") || "").trim() || null,
    logoUrl,
    signatureImageUrl,
  };

  await prisma.buildingPayeeSettings.upsert({
    where: { buildingId: building.id },
    create: { buildingId: building.id, ...data },
    update: data,
  });

  revalidatePath("/settings/payee");
}
