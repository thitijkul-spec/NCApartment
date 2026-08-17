"use server";

import { prisma } from "@/lib/prisma";
import { requireUser, setCurrentBuildingId } from "@/lib/auth";
import { deleteBuildingCascade } from "@/lib/building-delete";
import { seedNewBuildingDefaults } from "@/lib/building-seed";
import { redirect } from "next/navigation";

export async function enterBuilding(formData: FormData) {
  const user = await requireUser();
  const buildingId = Number(formData.get("buildingId"));
  if (!buildingId) return;

  if (user.role !== "owner") {
    const access = await prisma.userBuildingAccess.findUnique({
      where: { userId_buildingId: { userId: user.id, buildingId } },
    });
    if (!access) return;
  }

  await setCurrentBuildingId(buildingId);
  redirect("/");
}

export async function createBuilding(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "owner") return;

  const name = String(formData.get("name") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const floors = Number(formData.get("floors")) || null;
  if (!name) return { error: "กรุณากรอกชื่ออาคาร" };

  const building = await prisma.building.create({
    data: {
      name,
      address: address || null,
      floors,
      settings: { create: {} },
    },
  });

  await seedNewBuildingDefaults(building.id);

  redirect("/select-building");
}

export async function confirmDeleteBuilding(formData: FormData) {
  const user = await requireUser();
  if (user.role !== "owner") return { error: "เฉพาะเจ้าของระบบเท่านั้นที่ลบอาคารได้" };

  const buildingId = Number(formData.get("buildingId"));
  const typedName = String(formData.get("confirmName") || "").trim();
  const building = await prisma.building.findUnique({ where: { id: buildingId } });
  if (!building) return { error: "ไม่พบอาคารนี้" };
  if (typedName !== building.name) {
    return { error: "ชื่ออาคารที่พิมพ์ไม่ตรงกัน กรุณาพิมพ์ชื่ออาคารให้ตรงทุกตัวอักษร" };
  }

  const remaining = await prisma.building.count();
  if (remaining <= 1) {
    return { error: "ลบไม่ได้ — ต้องมีอย่างน้อย 1 อาคารในระบบเสมอ" };
  }

  await deleteBuildingCascade(buildingId);
  redirect("/select-building");
}
