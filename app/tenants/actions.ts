"use server";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { saveUploadedFile } from "@/lib/upload";
import { revalidatePath } from "next/cache";

function readVehicles(formData: FormData) {
  const plates = formData.getAll("vehiclePlateNo").map(String);
  const brands = formData.getAll("vehicleBrandModel").map(String);
  const colors = formData.getAll("vehicleColor").map(String);
  return plates
    .map((plateNo, i) => ({ plateNo, brandModel: brands[i] || "", color: colors[i] || "" }))
    .filter((v) => v.plateNo || v.brandModel);
}

function readTenantFields(formData: FormData) {
  return {
    name: String(formData.get("name") || "").trim(),
    phone: String(formData.get("phone") || "").trim() || null,
    gender: String(formData.get("gender") || "").trim() || null,
    age: formData.get("age") ? Number(formData.get("age")) : null,
    lineId: String(formData.get("lineId") || "").trim() || null,
    lineUserId: String(formData.get("lineUserId") || "").trim() || null,
    idCardNo: String(formData.get("idCardNo") || "").trim() || null,
    email: String(formData.get("email") || "").trim() || null,
    previousAddress: String(formData.get("previousAddress") || "").trim() || null,
    emergencyContactName: String(formData.get("emergencyContactName") || "").trim() || null,
    emergencyContactPhone: String(formData.get("emergencyContactPhone") || "").trim() || null,
    billLanguage: String(formData.get("billLanguage") || "th"),
    note: String(formData.get("note") || "").trim().slice(0, 2000) || null,
  };
}

async function findDuplicates(buildingId: number, phone: string | null, idCardNo: string | null, excludeId?: number) {
  if (!phone && !idCardNo) return [];
  return prisma.tenant.findMany({
    where: {
      buildingId,
      id: excludeId ? { not: excludeId } : undefined,
      archivedAt: null,
      OR: [phone ? { phone } : undefined, idCardNo ? { idCardNo } : undefined].filter(Boolean) as any,
    },
    select: { id: true, name: true, phone: true, idCardNo: true },
  });
}

export async function createTenant(formData: FormData) {
  const { building } = await requireAccess("tenant");
  const fields = readTenantFields(formData);
  if (!fields.name) return { error: "กรุณากรอกชื่อ-นามสกุล" };

  if (formData.get("confirmDuplicate") !== "on") {
    const dups = await findDuplicates(building.id, fields.phone, fields.idCardNo);
    if (dups.length > 0) {
      return { warning: `เบอร์โทร/เลขบัตรนี้ซ้ำกับ ${dups.map((d) => d.name).join(", ")} ในระบบแล้ว ยืนยันบันทึกต่อหรือไม่?` };
    }
  }

  const idCardImageUrl = await saveUploadedFile(formData.get("idCardImage") as File | null, "tenants");

  await prisma.tenant.create({
    data: {
      buildingId: building.id,
      ...fields,
      idCardImageUrl,
      tenantType: String(formData.get("tenantType") || "monthly"),
      vehicles: { create: readVehicles(formData) },
    },
  });

  revalidatePath("/tenants");
}

export async function updateTenant(formData: FormData) {
  const { building } = await requireAccess("tenant");
  const id = Number(formData.get("tenantId"));
  const existing = await prisma.tenant.findFirst({ where: { id, buildingId: building.id } });
  if (!existing) return { error: "ไม่พบผู้เช่า" };

  const fields = readTenantFields(formData);
  if (!fields.name) return { error: "กรุณากรอกชื่อ-นามสกุล" };

  if (formData.get("confirmDuplicate") !== "on") {
    const dups = await findDuplicates(building.id, fields.phone, fields.idCardNo, id);
    if (dups.length > 0) {
      return { warning: `เบอร์โทร/เลขบัตรนี้ซ้ำกับ ${dups.map((d) => d.name).join(", ")} ในระบบแล้ว ยืนยันบันทึกต่อหรือไม่?` };
    }
  }

  const idCardImageUrl = await saveUploadedFile(formData.get("idCardImage") as File | null, "tenants");

  await prisma.$transaction([
    prisma.tenantVehicle.deleteMany({ where: { tenantId: id } }),
    prisma.tenant.update({
      where: { id },
      data: {
        ...fields,
        ...(idCardImageUrl ? { idCardImageUrl } : {}),
        vehicles: { create: readVehicles(formData) },
      },
    }),
  ]);

  revalidatePath("/tenants");
}

export async function archiveTenant(formData: FormData) {
  const { building } = await requireAccess("tenant");
  const id = Number(formData.get("tenantId"));
  const tenant = await prisma.tenant.findFirst({
    where: { id, buildingId: building.id },
    include: { occupancies: { where: { status: "active" } } },
  });
  if (!tenant) return { error: "ไม่พบผู้เช่า" };
  if (tenant.occupancies.length > 0) {
    return { error: "เก็บเข้าคลังไม่ได้ — ผู้เช่ายังมีห้องที่เข้าพักอยู่ ต้องย้ายออกให้ครบก่อน" };
  }
  await prisma.tenant.update({ where: { id }, data: { archivedAt: new Date() } });
  revalidatePath("/tenants");
}

export async function restoreTenant(formData: FormData) {
  const { building } = await requireAccess("tenant");
  const id = Number(formData.get("tenantId"));
  await prisma.tenant.updateMany({ where: { id, buildingId: building.id }, data: { archivedAt: null } });
  revalidatePath("/tenants");
}

export async function deleteTenant(formData: FormData) {
  const { building } = await requireAccess("tenant");
  const id = Number(formData.get("tenantId"));
  const tenant = await prisma.tenant.findFirst({
    where: { id, buildingId: building.id },
    include: { occupancies: { where: { status: "active" } } },
  });
  if (!tenant) return { error: "ไม่พบผู้เช่า" };
  if (tenant.occupancies.length > 0) {
    return { error: "ลบไม่ได้ — ผู้เช่ายังมีห้องที่เข้าพักอยู่ ต้องย้ายออกให้ครบก่อน" };
  }

  const permanent = formData.get("permanent") === "on";
  if (permanent) {
    await prisma.$transaction([
      prisma.tenantVehicle.deleteMany({ where: { tenantId: id } }),
      prisma.tenant.delete({ where: { id } }),
    ]);
  } else {
    await prisma.tenant.update({ where: { id }, data: { archivedAt: new Date() } });
  }
  revalidatePath("/tenants");
}

type ImportRow = {
  name: string;
  phone: string;
  idCardNo: string;
  tenantType: string;
  roomNumber: string;
  checkinDate: string;
  depositAmount: string;
};

function parseCsv(text: string): ImportRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",").map((c) => c.trim());
    rows.push({
      name: cols[0] || "",
      phone: cols[1] || "",
      idCardNo: cols[2] || "",
      tenantType: cols[3] === "daily" ? "daily" : "monthly",
      roomNumber: cols[4] || "",
      checkinDate: cols[5] || "",
      depositAmount: cols[6] || "",
    });
  }
  return rows;
}

export async function importTenantsCsv(formData: FormData) {
  const { user, building } = await requireAccess("tenant");
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { error: "กรุณาเลือกไฟล์ CSV" };

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) return { error: "ไม่พบข้อมูลในไฟล์ (ต้องมีแถวหัวตาราง + อย่างน้อย 1 แถวข้อมูล)" };

  let imported = 0;
  const skipped: string[] = [];

  for (const row of rows) {
    if (!row.name) {
      skipped.push(`(ไม่มีชื่อ) — ข้ามแถว`);
      continue;
    }
    let roomId: number | null = null;
    if (row.roomNumber) {
      const room = await prisma.room.findFirst({ where: { buildingId: building.id, roomNumber: row.roomNumber } });
      if (!room) {
        skipped.push(`${row.name}: ไม่พบห้อง "${row.roomNumber}"`);
        continue;
      }
      const activeOcc = await prisma.roomOccupancy.findFirst({ where: { roomId: room.id, status: "active" } });
      if (activeOcc) {
        skipped.push(`${row.name}: ห้อง "${row.roomNumber}" มีผู้เช่าอยู่แล้ว`);
        continue;
      }
      roomId = room.id;
    }

    const checkinDate = row.checkinDate ? new Date(row.checkinDate) : new Date();

    const tenant = await prisma.tenant.create({
      data: {
        buildingId: building.id,
        name: row.name,
        phone: row.phone || null,
        idCardNo: row.idCardNo || null,
        tenantType: row.tenantType,
      },
    });

    if (roomId) {
      await prisma.$transaction([
        prisma.roomOccupancy.create({
          data: {
            tenantId: tenant.id,
            roomId,
            checkinDate: isNaN(checkinDate.getTime()) ? new Date() : checkinDate,
            depositAmount: row.depositAmount ? Number(row.depositAmount) : null,
            status: "active",
          },
        }),
        prisma.room.update({ where: { id: roomId }, data: { status: "occupied" } }),
      ]);
    }

    imported++;
  }

  revalidatePath("/tenants");
  revalidatePath("/rooms");
  return { success: true, imported, skipped };
}
