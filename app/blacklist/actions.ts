"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function addBlacklistEntry(formData: FormData) {
  const phone = String(formData.get("phone") || "").trim();
  const reason = String(formData.get("reason") || "").trim();
  if (!phone || !reason) return;

  await prisma.blacklist.create({ data: { phone, reason } });

  revalidatePath("/blacklist");
  revalidatePath("/customers");
  revalidatePath("/bookings");
}

export async function removeBlacklistEntry(id: number) {
  await prisma.blacklist.update({ where: { id }, data: { active: false } });

  revalidatePath("/blacklist");
  revalidatePath("/customers");
  revalidatePath("/bookings");
}
