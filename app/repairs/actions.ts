"use server";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { saveUploadedFile } from "@/lib/upload";
import { revalidatePath } from "next/cache";

export async function createRepairRequest(formData: FormData) {
  const { building } = await requireAccess("maintenance");
  const roomId = Number(formData.get("roomId"));
  const title = String(formData.get("title") || "").trim();
  const categoryId = Number(formData.get("categoryId"));
  if (!roomId || !title || !categoryId) return { error: "กรุณากรอกห้อง หัวข้อ และเลือกประเภทงาน" };

  const category = await prisma.repairCategory.findFirst({ where: { id: categoryId, buildingId: building.id } });
  if (!category) return { error: "ไม่พบประเภทงานซ่อม" };

  const occupancy = await prisma.roomOccupancy.findFirst({ where: { roomId, status: "active" } });

  const files = formData.getAll("photos") as File[];
  const photoUrls: string[] = [];
  for (const f of files.slice(0, 5)) {
    const url = await saveUploadedFile(f, "repairs");
    if (url) photoUrls.push(url);
  }

  await prisma.repairRequest.create({
    data: {
      buildingId: building.id,
      roomId,
      tenantId: occupancy?.tenantId ?? null,
      source: "staff_manual",
      title,
      description: String(formData.get("description") || "").trim(),
      categoryName: category.name,
      priority: String(formData.get("priority") || "medium"),
      assignedTechnicianId: formData.get("technicianId") ? Number(formData.get("technicianId")) : null,
      photos: photoUrls.length ? JSON.stringify(photoUrls) : null,
      isRead: true,
    },
  });

  revalidatePath("/repairs");
  revalidatePath("/rooms");
}

export async function updateRepairStatus(formData: FormData) {
  await requireAccess("maintenance");
  const id = Number(formData.get("requestId"));
  const status = String(formData.get("status") || "");
  await prisma.repairRequest.update({
    where: { id },
    data: { status, completedAt: status === "completed" ? new Date() : null },
  });
  revalidatePath("/repairs");
  revalidatePath("/rooms");
}

export async function assignTechnician(formData: FormData) {
  await requireAccess("maintenance");
  const id = Number(formData.get("requestId"));
  const technicianId = formData.get("technicianId") ? Number(formData.get("technicianId")) : null;
  await prisma.repairRequest.update({ where: { id }, data: { assignedTechnicianId: technicianId } });
  revalidatePath("/repairs");
}

export async function markRepairRead(requestId: number) {
  await requireAccess("maintenance");
  await prisma.repairRequest.update({ where: { id: requestId }, data: { isRead: true } });
  revalidatePath("/repairs");
}

export async function deleteRepairRequest(formData: FormData) {
  await requireAccess("maintenance");
  const id = Number(formData.get("requestId"));
  await prisma.repairRequest.delete({ where: { id } });
  revalidatePath("/repairs");
  revalidatePath("/rooms");
}

export async function createCategory(formData: FormData) {
  const { building } = await requireAccess("maintenance");
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await prisma.repairCategory.create({ data: { buildingId: building.id, name } });
  revalidatePath("/repairs");
}

export async function deleteCategory(formData: FormData) {
  await requireAccess("maintenance");
  const id = Number(formData.get("categoryId"));
  await prisma.repairCategory.delete({ where: { id } });
  revalidatePath("/repairs");
}

export async function createTechnician(formData: FormData) {
  const { building } = await requireAccess("maintenance");
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await prisma.technician.create({ data: { buildingId: building.id, name, phone: String(formData.get("phone") || "").trim() || null } });
  revalidatePath("/repairs");
}

export async function toggleTechnicianActive(formData: FormData) {
  await requireAccess("maintenance");
  const id = Number(formData.get("technicianId"));
  const active = formData.get("active") === "on";
  await prisma.technician.update({ where: { id }, data: { active } });
  revalidatePath("/repairs");
}

export async function createSharedEquipment(formData: FormData) {
  const { building } = await requireAccess("maintenance");
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await prisma.sharedEquipment.create({ data: { buildingId: building.id, name, type: String(formData.get("type") || "washer") } });
  revalidatePath("/repairs");
}

export async function deleteSharedEquipment(formData: FormData) {
  await requireAccess("maintenance");
  const id = Number(formData.get("equipmentId"));
  await prisma.sharedEquipment.delete({ where: { id } });
  revalidatePath("/repairs");
}

export async function createAirconBatch(formData: FormData) {
  const { building } = await requireAccess("maintenance");
  const roomIds = formData.getAll("roomIds").map(Number);
  if (roomIds.length === 0) return { error: "กรุณาเลือกอย่างน้อย 1 ห้อง" };

  const date = new Date(String(formData.get("date")));
  const technicianId = formData.get("technicianId") ? Number(formData.get("technicianId")) : null;
  const notes = String(formData.get("notes") || "").trim() || null;

  await prisma.maintenanceLog.createMany({
    data: roomIds.map((roomId) => ({
      buildingId: building.id,
      category: "aircon",
      roomId,
      date,
      technicianId,
      notes,
    })),
  });

  revalidatePath("/repairs");
  return { success: true, count: roomIds.length };
}
