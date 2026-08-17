"use server";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { revalidatePath } from "next/cache";

function numOrNull(formData: FormData, key: string) {
  const v = String(formData.get(key) || "").trim();
  return v === "" ? null : Number(v);
}

export async function updateBuildingSettings(formData: FormData) {
  const { building } = await requireAccess("setting");

  await prisma.buildingSettings.upsert({
    where: { buildingId: building.id },
    create: {
      buildingId: building.id,
      defaultWaterMode: String(formData.get("defaultWaterMode") || "flat"),
      defaultWaterRate: numOrNull(formData, "defaultWaterRate"),
      defaultElectricMode: String(formData.get("defaultElectricMode") || "flat"),
      defaultElectricRate: numOrNull(formData, "defaultElectricRate"),
      defaultInternetFee: numOrNull(formData, "defaultInternetFee"),
      defaultCommonAreaFee: numOrNull(formData, "defaultCommonAreaFee"),
      defaultMonthlyDeposit: numOrNull(formData, "defaultMonthlyDeposit"),
      defaultDailyDeposit: numOrNull(formData, "defaultDailyDeposit"),
      parcelOverdueDays: Number(formData.get("parcelOverdueDays")) || 3,
    },
    update: {
      defaultWaterMode: String(formData.get("defaultWaterMode") || "flat"),
      defaultWaterRate: numOrNull(formData, "defaultWaterRate"),
      defaultElectricMode: String(formData.get("defaultElectricMode") || "flat"),
      defaultElectricRate: numOrNull(formData, "defaultElectricRate"),
      defaultInternetFee: numOrNull(formData, "defaultInternetFee"),
      defaultCommonAreaFee: numOrNull(formData, "defaultCommonAreaFee"),
      defaultMonthlyDeposit: numOrNull(formData, "defaultMonthlyDeposit"),
      defaultDailyDeposit: numOrNull(formData, "defaultDailyDeposit"),
      parcelOverdueDays: Number(formData.get("parcelOverdueDays")) || 3,
    },
  });

  revalidatePath("/settings/building");
}
