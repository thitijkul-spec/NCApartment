"use server";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createAccount(formData: FormData) {
  const { building } = await requireAccess("setting");
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "กรุณากรอกชื่อบัญชี" };

  await prisma.account.create({
    data: {
      buildingId: building.id,
      name,
      type: String(formData.get("type") || "bank"),
      accountNumber: String(formData.get("accountNumber") || "").trim() || null,
    },
  });
  revalidatePath("/settings/accounts");
}

export async function updateAccountStatus(formData: FormData) {
  const { building } = await requireAccess("setting");
  const id = Number(formData.get("accountId"));
  const status = String(formData.get("status") || "active");
  await prisma.account.updateMany({ where: { id, buildingId: building.id }, data: { status } });
  revalidatePath("/settings/accounts");
}
