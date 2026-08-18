"use server";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { saveUploadedFile } from "@/lib/upload";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

function readParcelFields(formData: FormData) {
  const tenantId = formData.get("tenantId") ? Number(formData.get("tenantId")) : null;
  return {
    recipientName: String(formData.get("recipientName") || "").trim(),
    tenantId,
    deliveryCompany: String(formData.get("deliveryCompany") || "").trim() || null,
    trackingNo: String(formData.get("trackingNo") || "").trim() || null,
    receivedAt: new Date(String(formData.get("receivedAt"))),
    notes: String(formData.get("notes") || "").trim() || null,
  };
}

export async function createParcel(formData: FormData) {
  const { user, building } = await requireAccess("maintenance");
  const fields = readParcelFields(formData);
  if (!fields.recipientName) return { error: "กรุณากรอกชื่อผู้รับ" };
  if (isNaN(fields.receivedAt.getTime())) return { error: "กรุณาระบุวันที่และเวลาที่มาส่ง" };

  let roomId: number | null = null;
  if (fields.tenantId) {
    const occ = await prisma.roomOccupancy.findFirst({ where: { tenantId: fields.tenantId, status: "active" } });
    roomId = occ?.roomId ?? null;
  }

  const photoUrl = await saveUploadedFile(formData.get("photo") as File | null, "parcels");

  const parcel = await prisma.parcel.create({
    data: { buildingId: building.id, ...fields, roomId, photoUrl },
  });

  await logAudit({
    buildingId: building.id,
    actorUserId: user.id,
    actorName: user.name,
    actionType: "create",
    moduleTag: "พัสดุ",
    entityType: "Parcel",
    entityId: parcel.id,
    entityLabel: fields.recipientName,
    description: `บันทึกพัสดุเข้า — ${fields.recipientName}`,
  });

  revalidatePath("/parcels");
}

export async function updateParcel(formData: FormData) {
  const { building } = await requireAccess("maintenance");
  const id = Number(formData.get("parcelId"));
  const existing = await prisma.parcel.findFirst({ where: { id, buildingId: building.id } });
  if (!existing) return { error: "ไม่พบพัสดุ" };

  const fields = readParcelFields(formData);
  if (!fields.recipientName) return { error: "กรุณากรอกชื่อผู้รับ" };
  if (isNaN(fields.receivedAt.getTime())) return { error: "กรุณาระบุวันที่และเวลาที่มาส่ง" };

  let roomId: number | null = existing.roomId;
  if (fields.tenantId) {
    const occ = await prisma.roomOccupancy.findFirst({ where: { tenantId: fields.tenantId, status: "active" } });
    roomId = occ?.roomId ?? null;
  } else {
    roomId = null;
  }

  const photoUrl = await saveUploadedFile(formData.get("photo") as File | null, "parcels");

  await prisma.parcel.update({
    where: { id },
    data: { ...fields, roomId, ...(photoUrl ? { photoUrl } : {}) },
  });

  revalidatePath("/parcels");
}

export async function deleteParcel(formData: FormData) {
  const { user, building } = await requireAccess("maintenance");
  const id = Number(formData.get("parcelId"));
  const parcel = await prisma.parcel.findFirst({ where: { id, buildingId: building.id } });
  if (!parcel) return;
  await prisma.parcel.delete({ where: { id } });
  await logAudit({
    buildingId: building.id,
    actorUserId: user.id,
    actorName: user.name,
    actionType: "delete",
    moduleTag: "พัสดุ",
    entityType: "Parcel",
    entityId: id,
    entityLabel: parcel.recipientName,
    description: `ลบพัสดุ — ${parcel.recipientName}`,
  });
  revalidatePath("/parcels");
}

const STATUS_ORDER = ["arrived", "notified", "picked_up"];

export async function advanceParcelStatus(formData: FormData) {
  const { user, building } = await requireAccess("maintenance");
  const id = Number(formData.get("parcelId"));
  const parcel = await prisma.parcel.findFirst({ where: { id, buildingId: building.id } });
  if (!parcel) return { error: "ไม่พบพัสดุ" };

  const idx = STATUS_ORDER.indexOf(parcel.status);
  const next = STATUS_ORDER[Math.min(idx + 1, STATUS_ORDER.length - 1)];

  await prisma.parcel.update({
    where: { id },
    data: {
      status: next,
      pickedUpAt: next === "picked_up" ? new Date() : parcel.pickedUpAt,
    },
  });
  await logAudit({
    buildingId: building.id,
    actorUserId: user.id,
    actorName: user.name,
    actionType: "status_change",
    moduleTag: "พัสดุ",
    entityType: "Parcel",
    entityId: id,
    entityLabel: parcel.recipientName,
    description: `เปลี่ยนสถานะพัสดุ "${parcel.recipientName}" เป็น "${next}"`,
  });
  revalidatePath("/parcels");
}

export async function setParcelStatus(formData: FormData) {
  const { user, building } = await requireAccess("maintenance");
  const id = Number(formData.get("parcelId"));
  const status = String(formData.get("status") || "");
  const parcel = await prisma.parcel.findFirst({ where: { id, buildingId: building.id } });
  if (!parcel) return { error: "ไม่พบพัสดุ" };

  await prisma.parcel.update({
    where: { id },
    data: {
      status,
      pickedUpAt: status === "picked_up" ? new Date() : null,
    },
  });
  await logAudit({
    buildingId: building.id,
    actorUserId: user.id,
    actorName: user.name,
    actionType: "status_change",
    moduleTag: "พัสดุ",
    entityType: "Parcel",
    entityId: id,
    entityLabel: parcel.recipientName,
    description: `เปลี่ยนสถานะพัสดุ "${parcel.recipientName}" เป็น "${status}"`,
  });
  revalidatePath("/parcels");
}

/** แจ้งเตือนผู้เช่าผ่าน LINE — ยังไม่มี LINE OA integration จริงในระบบ (stub ทั้งระบบ) จึงแค่ generate ข้อความ + อัปเดตสถานะ/เวลาแจ้งเตือน คืนข้อความให้ UI แสดงว่า "จะส่ง" อะไร */
export async function notifyParcel(formData: FormData) {
  const { building } = await requireAccess("maintenance");
  const id = Number(formData.get("parcelId"));
  const parcel = await prisma.parcel.findFirst({
    where: { id, buildingId: building.id },
    include: { tenant: true, room: true },
  });
  if (!parcel) return { error: "ไม่พบพัสดุ" };
  if (!parcel.tenant?.lineUserId) return { error: "พัสดุนี้ยังไม่ได้โยงผู้เช่าที่ผูก LINE ไว้" };

  const message = `มีพัสดุมาส่งที่ห้อง ${parcel.room?.roomNumber ?? "-"} จาก ${parcel.deliveryCompany ?? "ไม่ระบุขนส่ง"}`;

  await prisma.parcel.update({
    where: { id },
    data: {
      notifiedAt: new Date(),
      status: parcel.status === "arrived" ? "notified" : parcel.status,
    },
  });

  revalidatePath("/parcels");
  return { success: true, message };
}
