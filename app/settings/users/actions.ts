"use server";

import { prisma } from "@/lib/prisma";
import { hashPassword, requireUser, MODULES } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

function readPermissions(formData: FormData) {
  return MODULES.filter((m) => formData.get(`perm_${m.code}`) === "on")
    .map((m) => m.code)
    .join(",");
}

function readBuildingIds(formData: FormData) {
  return formData
    .getAll("buildingIds")
    .map((v) => Number(v))
    .filter((n) => !Number.isNaN(n) && n > 0);
}

export async function createStaffUser(formData: FormData) {
  const owner = await requireUser();
  if (owner.role !== "owner") return { error: "เฉพาะเจ้าของระบบเท่านั้น" };

  const name = String(formData.get("name") || "").trim();
  const username = String(formData.get("username") || "").trim();
  const password = String(formData.get("password") || "");
  if (!name || !username || password.length < 4) {
    return { error: "กรอกชื่อ/ชื่อผู้ใช้ และรหัสผ่านอย่างน้อย 4 ตัวอักษร" };
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) return { error: "มีชื่อผู้ใช้นี้อยู่แล้ว" };

  const buildingIds = readBuildingIds(formData);
  const permissions = readPermissions(formData);

  const newUser = await prisma.user.create({
    data: {
      name,
      username,
      passwordHash: hashPassword(password),
      role: "staff",
      permissions,
      buildingAccess: { create: buildingIds.map((buildingId) => ({ buildingId })) },
    },
  });

  if (buildingIds[0]) {
    await logAudit({
      buildingId: buildingIds[0],
      actorUserId: owner.id,
      actorName: owner.name,
      actionType: "create",
      moduleTag: "ตั้งค่า",
      entityType: "User",
      entityId: newUser.id,
      entityLabel: newUser.name,
      description: `เพิ่มผู้ใช้งาน ${newUser.name} (${newUser.username})`,
    });
  }

  revalidatePath("/settings/users");
}

export async function updateStaffUser(formData: FormData) {
  const owner = await requireUser();
  if (owner.role !== "owner") return;

  const id = Number(formData.get("userId"));
  if (!id) return;

  const active = formData.get("active") === "on";
  const buildingIds = readBuildingIds(formData);
  const permissions = readPermissions(formData);

  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { active, permissions } }),
    prisma.userBuildingAccess.deleteMany({ where: { userId: id } }),
    prisma.userBuildingAccess.createMany({
      data: buildingIds.map((buildingId) => ({ userId: id, buildingId })),
    }),
  ]);

  revalidatePath("/settings/users");
}

export async function resetStaffPassword(formData: FormData) {
  const owner = await requireUser();
  if (owner.role !== "owner") return { error: "เฉพาะเจ้าของระบบเท่านั้น" };

  const id = Number(formData.get("userId"));
  const password = String(formData.get("password") || "");
  if (!id || password.length < 4) return { error: "รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร" };

  await prisma.user.update({ where: { id }, data: { passwordHash: hashPassword(password) } });
  revalidatePath("/settings/users");
}
