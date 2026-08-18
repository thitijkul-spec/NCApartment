"use server";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { revalidatePath } from "next/cache";

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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

// บันทึกมิเตอร์หลายห้องพร้อมกันจากตารางกรอกสดในหน้าเดียว (แบบ Excel) — ไม่ต้องเปิดฟอร์มทีละห้อง
// ห้องที่ยังไม่มีบันทึกของเดือนนี้ = สร้างใหม่ / ห้องที่บันทึกแล้วแต่ยังไม่ออกบิล = แก้ไขค่าเดิมแทนการสร้างซ้ำ
export async function bulkRecordMeterReadings(formData: FormData) {
  const { user, building } = await requireAccess("room");
  const rowsJson = String(formData.get("rowsJson") || "[]");
  let rows: Array<{ roomId: number; waterCurrent: number | null; electricCurrent: number | null }>;
  try {
    rows = JSON.parse(rowsJson);
  } catch {
    return { error: "ข้อมูลไม่ถูกต้อง" };
  }
  if (!Array.isArray(rows) || rows.length === 0) return { error: "ไม่มีรายการที่จะบันทึก" };

  const rooms = await prisma.room.findMany({ where: { id: { in: rows.map((r) => r.roomId) }, buildingId: building.id } });
  const roomMap = new Map(rooms.map((r) => [r.id, r]));
  const month = String(formData.get("month") || currentMonthKey());

  const warnings: string[] = [];
  let saved = 0;

  for (const row of rows) {
    const room = roomMap.get(row.roomId);
    if (!room) continue;
    if (row.waterCurrent == null && row.electricCurrent == null) continue;

    const existingThisMonth = await prisma.meterReading.findFirst({
      where: { roomId: row.roomId, readingMonth: month },
      orderBy: { recordedAt: "desc" },
    });

    if (existingThisMonth) {
      if (existingThisMonth.billingStatus === "billed") {
        warnings.push(`ห้อง ${room.roomNumber}: ออกบิลแล้ว ข้ามการแก้ไข`);
        continue;
      }
      const waterCurrent = row.waterCurrent ?? existingThisMonth.waterCurrent;
      const electricCurrent = row.electricCurrent ?? existingThisMonth.electricCurrent;
      const waterUnits = waterCurrent - existingThisMonth.waterPrev;
      const electricUnits = electricCurrent - existingThisMonth.electricPrev;
      if (waterUnits < 0) warnings.push(`ห้อง ${room.roomNumber}: มิเตอร์น้ำน้อยกว่าครั้งก่อน`);
      if (electricUnits < 0) warnings.push(`ห้อง ${room.roomNumber}: มิเตอร์ไฟน้อยกว่าครั้งก่อน`);

      await prisma.meterReading.update({
        where: { id: existingThisMonth.id },
        data: { waterCurrent, waterUnits, electricCurrent, electricUnits },
      });
    } else {
      // หา reading เดือนล่าสุดที่ "ก่อน" เดือนที่กำลังบันทึก (ไม่ใช้ recordedAt เพราะอาจกรอกย้อนหลังไม่เรียงตามเวลาจริง)
      const last = await prisma.meterReading.findFirst({
        where: { roomId: row.roomId, readingMonth: { lt: month } },
        orderBy: { readingMonth: "desc" },
      });
      const waterPrev = last?.waterCurrent ?? 0;
      const electricPrev = last?.electricCurrent ?? 0;
      const waterCurrent = row.waterCurrent ?? waterPrev;
      const electricCurrent = row.electricCurrent ?? electricPrev;
      const waterUnits = waterCurrent - waterPrev;
      const electricUnits = electricCurrent - electricPrev;
      if (waterUnits < 0) warnings.push(`ห้อง ${room.roomNumber}: มิเตอร์น้ำน้อยกว่าครั้งก่อน`);
      if (electricUnits < 0) warnings.push(`ห้อง ${room.roomNumber}: มิเตอร์ไฟน้อยกว่าครั้งก่อน`);

      await prisma.meterReading.create({
        data: {
          roomId: row.roomId,
          buildingId: building.id,
          readingMonth: month,
          waterPrev,
          waterCurrent,
          waterUnits,
          electricPrev,
          electricCurrent,
          electricUnits,
          recordedBy: user.id,
        },
      });
    }
    saved++;
  }

  revalidatePath("/meters");
  revalidatePath("/rooms");
  return { success: true, saved, warnings };
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

  const month = String(formData.get("month") || currentMonthKey());
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
    const existing = await prisma.meterReading.findFirst({ where: { roomId: room.id, readingMonth: month } });
    if (existing) {
      skipped.push(`ห้อง "${row.roomNumber}" มีบันทึกของเดือน ${month} อยู่แล้ว ข้าม`);
      continue;
    }
    const last = await prisma.meterReading.findFirst({
      where: { roomId: room.id, readingMonth: { lt: month } },
      orderBy: { readingMonth: "desc" },
    });
    const waterPrev = last?.waterCurrent ?? 0;
    const electricPrev = last?.electricCurrent ?? 0;
    const waterCurrent = row.waterCurrent ? Number(row.waterCurrent) : waterPrev;
    const electricCurrent = row.electricCurrent ? Number(row.electricCurrent) : electricPrev;

    await prisma.meterReading.create({
      data: {
        roomId: room.id,
        buildingId: building.id,
        readingMonth: month,
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
