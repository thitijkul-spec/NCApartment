"use server";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { saveUploadedFile } from "@/lib/upload";
import { serializeUtility } from "@/lib/room-utils";
import { revalidatePath } from "next/cache";

function readUtilityMetered(formData: FormData, prefix: string) {
  return serializeUtility({
    excluded: formData.get(`${prefix}_excluded`) === "on",
    useBuildingDefault: formData.get(`${prefix}_useDefault`) === "on",
    mode: String(formData.get(`${prefix}_mode`) || "flat"),
    rate: formData.get(`${prefix}_rate`) ? Number(formData.get(`${prefix}_rate`)) : undefined,
  });
}

function readUtilityFlat(formData: FormData, prefix: string) {
  return serializeUtility({
    excluded: formData.get(`${prefix}_excluded`) === "on",
    useBuildingDefault: formData.get(`${prefix}_useDefault`) === "on",
    amount: formData.get(`${prefix}_amount`) ? Number(formData.get(`${prefix}_amount`)) : undefined,
  });
}

function readRoomCommonFields(formData: FormData) {
  return {
    roomNumber: String(formData.get("roomNumber") || "").trim(),
    floor: Number(formData.get("floor")) || 0,
    rentalTypeSupport: String(formData.get("rentalTypeSupport") || "monthly"),
    monthlyPrice: formData.get("monthlyPrice") ? Number(formData.get("monthlyPrice")) : null,
    dailyPrice: formData.get("dailyPrice") ? Number(formData.get("dailyPrice")) : null,
    monthlyDeposit: formData.get("monthlyDeposit") ? Number(formData.get("monthlyDeposit")) : null,
    dailyDeposit: formData.get("dailyDeposit") ? Number(formData.get("dailyDeposit")) : null,
    sizeSqm: formData.get("sizeSqm") ? Number(formData.get("sizeSqm")) : null,
    utilityWater: readUtilityMetered(formData, "water"),
    utilityElectric: readUtilityMetered(formData, "electric"),
    utilityInternet: readUtilityFlat(formData, "internet"),
    utilityCommonArea: readUtilityFlat(formData, "commonArea"),
    amenities: serializeUtility(formData.getAll("amenities").map(String)),
    extraMonthlyFees: serializeUtility(
      formData
        .getAll("extraFeeName")
        .map((name, i) => ({ name: String(name), amount: Number(formData.getAll("extraFeeAmount")[i] || 0) }))
        .filter((f) => f.name)
    ),
    notes: String(formData.get("notes") || "").trim() || null,
  };
}

export async function createRoom(formData: FormData) {
  const { building } = await requireAccess("room");
  const fields = readRoomCommonFields(formData);
  if (!fields.roomNumber) return { error: "กรุณากรอกหมายเลขห้อง" };
  if (!fields.monthlyPrice && !fields.dailyPrice) return { error: "กรุณากรอกราคาอย่างน้อย 1 ประเภท" };

  try {
    const room = await prisma.room.create({
      data: {
        buildingId: building.id,
        status: String(formData.get("status") || "available"),
        ...fields,
      },
    });

    const files = formData.getAll("images") as File[];
    await attachImages(room.id, building.id, files);
  } catch (e: any) {
    if (e?.code === "P2002") return { error: `หมายเลขห้อง "${fields.roomNumber}" มีอยู่แล้วในอาคารนี้` };
    throw e;
  }

  revalidatePath("/rooms");
}

async function attachImages(roomId: number, buildingId: number, files: File[]) {
  for (const file of files) {
    if (!file || file.size === 0) continue;
    const url = await saveUploadedFile(file, "rooms");
    if (url) await prisma.roomImage.create({ data: { roomId, buildingId, url } });
  }
}

export async function updateRoom(formData: FormData) {
  const { building } = await requireAccess("room");
  const id = Number(formData.get("roomId"));
  if (!id) return { error: "ไม่พบห้อง" };

  const existing = await prisma.room.findFirst({ where: { id, buildingId: building.id } });
  if (!existing) return { error: "ไม่พบห้อง" };

  const fields = readRoomCommonFields(formData);
  if (!fields.roomNumber) return { error: "กรุณากรอกหมายเลขห้อง" };
  if (!fields.monthlyPrice && !fields.dailyPrice) return { error: "กรุณากรอกราคาอย่างน้อย 1 ประเภท" };

  if (fields.rentalTypeSupport !== existing.rentalTypeSupport && existing.status === "occupied") {
    const activeOccupancy = await prisma.roomOccupancy.findFirst({
      where: { roomId: id, status: "active" },
      include: { tenant: true },
    });
    if (activeOccupancy) {
      const tenantType = activeOccupancy.tenant.tenantType;
      if (fields.rentalTypeSupport !== "both" && fields.rentalTypeSupport !== tenantType) {
        return {
          error: `แก้ไข "ประเภทการรองรับ" ไม่ได้ — ห้องนี้มีผู้เช่าแบบ${
            tenantType === "monthly" ? "รายเดือน" : "รายวัน"
          }อยู่ ต้องให้ห้องว่างก่อน`,
        };
      }
    }
  }

  try {
    await prisma.room.update({
      where: { id },
      data: {
        status: String(formData.get("status") || existing.status),
        maintenanceReason:
          String(formData.get("status") || existing.status) === "maintenance"
            ? String(formData.get("maintenanceReason") || "").trim() || null
            : null,
        ...fields,
      },
    });

    const files = formData.getAll("images") as File[];
    await attachImages(id, building.id, files);

    const coverImageId = formData.get("coverImageId");
    if (coverImageId) {
      await prisma.room.update({ where: { id }, data: { coverImageId: Number(coverImageId) } });
    }
  } catch (e: any) {
    if (e?.code === "P2002") return { error: `หมายเลขห้อง "${fields.roomNumber}" มีอยู่แล้วในอาคารนี้` };
    throw e;
  }

  revalidatePath("/rooms");
}

export async function deleteRoomImage(formData: FormData) {
  const { building } = await requireAccess("room");
  const imageId = Number(formData.get("imageId"));
  if (!imageId) return;
  await prisma.roomImage.deleteMany({ where: { id: imageId, buildingId: building.id } });
  revalidatePath("/rooms");
}

export async function deleteRoom(formData: FormData) {
  const { building } = await requireAccess("room");
  const id = Number(formData.get("roomId"));
  const room = await prisma.room.findFirst({ where: { id, buildingId: building.id } });
  if (!room) return { error: "ไม่พบห้อง" };
  if (room.status !== "available" && room.status !== "maintenance") {
    return { error: `ลบห้อง ${room.roomNumber} ไม่ได้ เนื่องจากห้องมีสถานะ "${room.status === "occupied" ? "มีผู้เช่า" : "จองแล้ว"}"` };
  }
  await prisma.room.delete({ where: { id } });
  revalidatePath("/rooms");
}

export async function bulkDeleteRooms(formData: FormData) {
  const { building } = await requireAccess("room");
  const ids = formData.getAll("roomIds").map(Number);
  const rooms = await prisma.room.findMany({ where: { id: { in: ids }, buildingId: building.id } });

  const blocked = rooms.filter((r) => r.status !== "available" && r.status !== "maintenance");
  if (blocked.length > 0) {
    return { error: `ไม่สามารถลบห้อง ${blocked.map((r) => r.roomNumber).join(", ")} ได้ เนื่องจากมีผู้เช่า/ถูกจองอยู่` };
  }

  await prisma.room.deleteMany({ where: { id: { in: ids }, buildingId: building.id } });
  revalidatePath("/rooms");
}

export async function bulkUpdateRooms(formData: FormData) {
  const { building } = await requireAccess("room");
  const ids = formData.getAll("roomIds").map(Number);
  const rooms = await prisma.room.findMany({ where: { id: { in: ids }, buildingId: building.id } });

  const data: Record<string, unknown> = {};
  const rentalTypeSupport = String(formData.get("rentalTypeSupport") || "");
  if (rentalTypeSupport) {
    const occupiedMismatch = rooms.filter((r) => r.status === "occupied" && r.rentalTypeSupport !== rentalTypeSupport && rentalTypeSupport !== "both");
    if (occupiedMismatch.length > 0) {
      return {
        error: `ไม่สามารถแก้ "ประเภทการรองรับ" ของห้อง ${occupiedMismatch
          .map((r) => r.roomNumber)
          .join(", ")} ได้ เนื่องจากมีผู้เช่าอยู่`,
      };
    }
    data.rentalTypeSupport = rentalTypeSupport;
  }
  if (formData.get("monthlyPrice")) data.monthlyPrice = Number(formData.get("monthlyPrice"));
  if (formData.get("dailyPrice")) data.dailyPrice = Number(formData.get("dailyPrice"));
  if (formData.get("monthlyDeposit")) data.monthlyDeposit = Number(formData.get("monthlyDeposit"));
  if (formData.get("dailyDeposit")) data.dailyDeposit = Number(formData.get("dailyDeposit"));
  const status = String(formData.get("status") || "");
  if (status) data.status = status;

  if (Object.keys(data).length === 0) return { error: "ไม่มีการเปลี่ยนแปลงที่จะบันทึก" };

  await prisma.room.updateMany({ where: { id: { in: ids }, buildingId: building.id }, data });
  revalidatePath("/rooms");
}

export async function bulkCreateRooms(formData: FormData) {
  const { building } = await requireAccess("room");
  const rowsJson = String(formData.get("rowsJson") || "[]");
  let rows: Array<{
    roomNumber: string;
    floor: number;
    rentalTypeSupport: string;
    monthlyPrice: number | null;
    dailyPrice: number | null;
    status: string;
  }>;
  try {
    rows = JSON.parse(rowsJson);
  } catch {
    return { error: "ข้อมูลไม่ถูกต้อง" };
  }
  if (!Array.isArray(rows) || rows.length === 0) return { error: "ไม่มีห้องที่จะสร้าง" };

  const existingNumbers = new Set(
    (await prisma.room.findMany({ where: { buildingId: building.id }, select: { roomNumber: true } })).map(
      (r) => r.roomNumber
    )
  );
  const dupInRequest = new Set<string>();
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.roomNumber) || existingNumbers.has(r.roomNumber)) dupInRequest.add(r.roomNumber);
    seen.add(r.roomNumber);
  }
  if (dupInRequest.size > 0) {
    return { error: `หมายเลขห้องซ้ำ: ${Array.from(dupInRequest).join(", ")}` };
  }

  await prisma.room.createMany({
    data: rows.map((r) => ({
      buildingId: building.id,
      roomNumber: r.roomNumber,
      floor: r.floor,
      rentalTypeSupport: r.rentalTypeSupport,
      monthlyPrice: r.monthlyPrice,
      dailyPrice: r.dailyPrice,
      status: r.status || "available",
    })),
  });

  revalidatePath("/rooms");
}
