"use server";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { revalidatePath } from "next/cache";

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function checkAnomalies(roomId: number, waterUnits: number, electricUnits: number, waterCurrent: number, waterPrev: number, electricCurrent: number, electricPrev: number) {
  const warnings: string[] = [];
  if (waterCurrent < waterPrev) warnings.push("ค่ามิเตอร์น้ำน้อยกว่าครั้งก่อน (ผิดปกติ)");
  if (electricCurrent < electricPrev) warnings.push("ค่ามิเตอร์ไฟน้อยกว่าครั้งก่อน (ผิดปกติ)");

  const history = await prisma.meterReading.findMany({
    where: { roomId },
    orderBy: { recordedAt: "desc" },
    take: 4,
  });
  if (history.length >= 2) {
    const avgWater = history.reduce((s, h) => s + h.waterUnits, 0) / history.length;
    const avgElectric = history.reduce((s, h) => s + h.electricUnits, 0) / history.length;
    if (avgWater > 0 && Math.abs(waterUnits - avgWater) / avgWater > 0.5) {
      warnings.push(`หน่วยน้ำที่ใช้ (${waterUnits.toFixed(1)}) ต่างจากค่าเฉลี่ยเดิม (${avgWater.toFixed(1)}) มาก`);
    }
    if (avgElectric > 0 && Math.abs(electricUnits - avgElectric) / avgElectric > 0.5) {
      warnings.push(`หน่วยไฟที่ใช้ (${electricUnits.toFixed(1)}) ต่างจากค่าเฉลี่ยเดิม (${avgElectric.toFixed(1)}) มาก`);
    }
  }
  return warnings;
}

export async function recordMeterReading(formData: FormData) {
  const { user, building } = await requireAccess("room");
  const roomId = Number(formData.get("roomId"));
  const room = await prisma.room.findFirst({ where: { id: roomId, buildingId: building.id } });
  if (!room) return { error: "ไม่พบห้อง" };

  const waterCurrent = Number(formData.get("waterCurrent") || 0);
  const electricCurrent = Number(formData.get("electricCurrent") || 0);

  const last = await prisma.meterReading.findFirst({ where: { roomId }, orderBy: { recordedAt: "desc" } });
  const waterPrev = last?.waterCurrent ?? 0;
  const electricPrev = last?.electricCurrent ?? 0;
  const waterUnits = waterCurrent - waterPrev;
  const electricUnits = electricCurrent - electricPrev;

  if (formData.get("confirmAnyway") !== "on") {
    const warnings = await checkAnomalies(roomId, waterUnits, electricUnits, waterCurrent, waterPrev, electricCurrent, electricPrev);
    if (warnings.length > 0) return { warning: warnings.join(" / ") };
  }

  await prisma.meterReading.create({
    data: {
      roomId,
      buildingId: building.id,
      readingMonth: currentMonthKey(),
      waterPrev,
      waterCurrent,
      waterUnits,
      electricPrev,
      electricCurrent,
      electricUnits,
      recordedBy: user.id,
    },
  });

  revalidatePath("/meters");
  revalidatePath("/rooms");
}

export async function updateMeterReading(formData: FormData) {
  const { building } = await requireAccess("room");
  const id = Number(formData.get("readingId"));
  const reading = await prisma.meterReading.findFirst({ where: { id, buildingId: building.id } });
  if (!reading) return { error: "ไม่พบข้อมูล" };
  if (reading.billingStatus === "billed") return { error: "แก้ไขไม่ได้ — ออกบิลไปแล้ว" };

  const waterCurrent = Number(formData.get("waterCurrent") || 0);
  const electricCurrent = Number(formData.get("electricCurrent") || 0);

  await prisma.meterReading.update({
    where: { id },
    data: {
      waterCurrent,
      waterUnits: waterCurrent - reading.waterPrev,
      electricCurrent,
      electricUnits: electricCurrent - reading.electricPrev,
    },
  });

  revalidatePath("/meters");
}

type ImportRow = { roomNumber: string; waterCurrent: string; electricCurrent: string };

function parseCsv(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    rows.push({ roomNumber: cols[0] || "", waterCurrent: cols[2] || "", electricCurrent: cols[4] || "" });
  }
  return rows;
}

export async function importMetersCsv(formData: FormData) {
  const { user, building } = await requireAccess("room");
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "กรุณาเลือกไฟล์" };

  const rows = parseCsv(await file.text());
  const skipped: string[] = [];
  let imported = 0;

  for (const row of rows) {
    if (!row.roomNumber || (!row.waterCurrent && !row.electricCurrent)) continue;
    const room = await prisma.room.findFirst({ where: { buildingId: building.id, roomNumber: row.roomNumber } });
    if (!room) {
      skipped.push(`ห้อง "${row.roomNumber}" ไม่พบในระบบ`);
      continue;
    }
    const last = await prisma.meterReading.findFirst({ where: { roomId: room.id }, orderBy: { recordedAt: "desc" } });
    const waterPrev = last?.waterCurrent ?? 0;
    const electricPrev = last?.electricCurrent ?? 0;
    const waterCurrent = row.waterCurrent ? Number(row.waterCurrent) : waterPrev;
    const electricCurrent = row.electricCurrent ? Number(row.electricCurrent) : electricPrev;

    await prisma.meterReading.create({
      data: {
        roomId: room.id,
        buildingId: building.id,
        readingMonth: currentMonthKey(),
        waterPrev,
        waterCurrent,
        waterUnits: waterCurrent - waterPrev,
        electricPrev,
        electricCurrent,
        electricUnits: electricCurrent - electricPrev,
        recordedBy: user.id,
      },
    });
    imported++;
  }

  revalidatePath("/meters");
  return { success: true, imported, skipped };
}
