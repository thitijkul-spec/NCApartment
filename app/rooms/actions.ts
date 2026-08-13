"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function getDefaultBranch() {
  let branch = await prisma.branch.findFirst();
  if (!branch) {
    branch = await prisma.branch.create({ data: { name: "สาขาหลัก" } });
  }
  return branch;
}

export async function ensureDefaultRoomType(branchId: number) {
  let roomType = await prisma.roomType.findFirst({ where: { branchId } });
  if (!roomType) {
    roomType = await prisma.roomType.create({
      data: { branchId, name: "ทั่วไป" },
    });
  }
  return roomType;
}

export async function createRoomType(formData: FormData) {
  const branch = await getDefaultBranch();
  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const priceDaily = formData.get("priceDaily");
  const priceMonthly = formData.get("priceMonthly");
  const priceDeposit = formData.get("priceDeposit");
  const maxOccupancy = formData.get("maxOccupancy");

  await prisma.roomType.create({
    data: {
      branchId: branch.id,
      name,
      priceDaily: priceDaily ? Number(priceDaily) : null,
      priceMonthly: priceMonthly ? Number(priceMonthly) : null,
      priceDeposit: priceDeposit ? Number(priceDeposit) : null,
      maxOccupancy: maxOccupancy ? Number(maxOccupancy) : null,
    },
  });

  revalidatePath("/rooms");
}

export async function createRoom(formData: FormData) {
  const branch = await getDefaultBranch();
  const roomNumber = String(formData.get("roomNumber") || "").trim();
  const roomTypeId = Number(formData.get("roomTypeId"));
  const floor = String(formData.get("floor") || "").trim();
  const currentMode = String(formData.get("currentMode") || "monthly");
  const waterElectricMode = String(formData.get("waterElectricMode") || "metered");
  const priceMonthly = formData.get("priceMonthly");
  const priceDaily = formData.get("priceDaily");
  const status = String(formData.get("status") || "available");

  if (!roomNumber || !roomTypeId) return { error: "กรอกข้อมูลไม่ครบ" };

  const existing = await prisma.room.findFirst({
    where: { branchId: branch.id, roomNumber },
  });
  if (existing) return { error: `มีห้อง ${roomNumber} อยู่แล้ว` };

  await prisma.room.create({
    data: {
      branchId: branch.id,
      roomTypeId,
      roomNumber,
      floor: floor || null,
      currentMode,
      waterElectricMode,
      status,
      priceMonthly: priceMonthly ? Number(priceMonthly) : null,
      priceDaily: priceDaily ? Number(priceDaily) : null,
    },
  });

  revalidatePath("/rooms");
  return { success: true };
}

type BulkRoomRow = {
  roomNumber: string;
  floor: string;
  mode: string;
  priceMonthly: number | null;
  priceDaily: number | null;
  status: string;
};

export async function createRoomsBulk(rows: BulkRoomRow[]) {
  const branch = await getDefaultBranch();
  const roomType = await ensureDefaultRoomType(branch.id);

  const cleanRows = rows
    .map((r) => ({ ...r, roomNumber: String(r.roomNumber || "").trim() }))
    .filter((r) => r.roomNumber);

  if (cleanRows.length === 0) return { created: 0, skipped: 0, skippedNumbers: [] };

  const existingRooms = await prisma.room.findMany({
    where: { branchId: branch.id, roomNumber: { in: cleanRows.map((r) => r.roomNumber) } },
    select: { roomNumber: true },
  });
  const existingSet = new Set(existingRooms.map((r) => r.roomNumber));

  const toCreate = cleanRows.filter((r) => !existingSet.has(r.roomNumber));
  const skippedNumbers = cleanRows.filter((r) => existingSet.has(r.roomNumber)).map((r) => r.roomNumber);

  if (toCreate.length > 0) {
    await prisma.room.createMany({
      data: toCreate.map((r) => ({
        branchId: branch.id,
        roomTypeId: roomType.id,
        roomNumber: r.roomNumber,
        floor: r.floor || null,
        currentMode: r.mode === "daily" ? "daily" : "monthly",
        status: ["available", "unavailable", "blocked"].includes(r.status) ? r.status : "available",
        priceMonthly: r.priceMonthly ?? null,
        priceDaily: r.priceDaily ?? null,
      })),
    });
  }

  revalidatePath("/rooms");
  return { created: toCreate.length, skipped: skippedNumbers.length, skippedNumbers };
}

export async function setRoomStatus(roomId: number, status: string) {
  await prisma.room.update({
    where: { id: roomId },
    data: { status },
  });
  revalidatePath("/rooms");
}

export async function bulkSetRoomStatus(roomIds: number[], status: string) {
  if (roomIds.length === 0) return;
  await prisma.room.updateMany({
    where: { id: { in: roomIds } },
    data: { status },
  });
  revalidatePath("/rooms");
}
