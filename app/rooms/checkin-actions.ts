"use server";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { saveUploadedFile } from "@/lib/upload";
import { revalidatePath } from "next/cache";

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function readVehicles(formData: FormData) {
  const plates = formData.getAll("vehiclePlateNo").map(String);
  const brands = formData.getAll("vehicleBrandModel").map(String);
  const colors = formData.getAll("vehicleColor").map(String);
  return plates
    .map((plateNo, i) => ({ plateNo, brandModel: brands[i] || "", color: colors[i] || "" }))
    .filter((v) => v.plateNo || v.brandModel);
}

export async function checkInTenant(formData: FormData) {
  const { user, building } = await requireAccess("room");

  const roomId = Number(formData.get("roomId"));
  const room = await prisma.room.findFirst({ where: { id: roomId, buildingId: building.id } });
  if (!room) return { error: "ไม่พบห้อง" };

  const isReservation = formData.get("isReservation") === "on";
  // จองล่วงหน้าเลือกห้องไหนก็ได้ไม่กรองสถานะ (ไม่ป้องกันจอง/เช็คอินซ้อนทับ) — เช็คอินจริงเท่านั้นที่ห้องต้องว่าง/จองแล้วจริงๆ
  if (!isReservation && room.status !== "available" && room.status !== "reserved") {
    return { error: "ห้องนี้ไม่ว่าง ไม่สามารถเพิ่มผู้เช่าได้" };
  }

  const tenantType = String(formData.get("tenantType") || "monthly");
  const checkinDate = new Date(String(formData.get("checkinDate")));
  if (isNaN(checkinDate.getTime())) return { error: "กรุณาระบุวันเข้าพัก" };

  const mode = String(formData.get("mode") || "new");
  const bookingId = formData.get("bookingId") ? Number(formData.get("bookingId")) : null;

  let tenantId: number;
  if (mode === "existing") {
    const existingId = Number(formData.get("existingTenantId"));
    const tenant = await prisma.tenant.findFirst({ where: { id: existingId, buildingId: building.id } });
    if (!tenant) return { error: "ไม่พบผู้เช่าที่เลือก" };
    await prisma.tenant.update({ where: { id: tenant.id }, data: { tenantType } });
    tenantId = tenant.id;
  } else {
    const name = String(formData.get("name") || "").trim();
    if (!name) return { error: "กรุณากรอกชื่อผู้เช่า" };

    const idCardImageUrl = await saveUploadedFile(formData.get("idCardImage") as File | null, "tenants");

    const tenant = await prisma.tenant.create({
      data: {
        buildingId: building.id,
        name,
        idCardImageUrl,
        phone: String(formData.get("phone") || "").trim() || null,
        gender: String(formData.get("gender") || "").trim() || null,
        age: formData.get("age") ? Number(formData.get("age")) : null,
        lineId: String(formData.get("lineId") || "").trim() || null,
        idCardNo: String(formData.get("idCardNo") || "").trim() || null,
        email: String(formData.get("email") || "").trim() || null,
        previousAddress: String(formData.get("previousAddress") || "").trim() || null,
        emergencyContactName: String(formData.get("emergencyContactName") || "").trim() || null,
        emergencyContactPhone: String(formData.get("emergencyContactPhone") || "").trim() || null,
        billLanguage: String(formData.get("billLanguage") || "th"),
        note: String(formData.get("note") || "").trim() || null,
        tenantType,
        vehicles: { create: readVehicles(formData) },
      },
    });
    tenantId = tenant.id;
  }

  if (isReservation) {
    const nights = formData.get("nights") ? Number(formData.get("nights")) : null;
    const checkoutDate = formData.get("checkoutDate") ? new Date(String(formData.get("checkoutDate"))) : null;

    const ops: any[] = [
      prisma.booking.create({
        data: {
          bookingCode: `BK${Date.now().toString(36).toUpperCase()}`,
          buildingId: building.id,
          roomId,
          tenantId,
          bookingType: tenantType,
          checkinDate,
          contractDeadlineDate: tenantType === "monthly" && formData.get("contractDeadlineDate")
            ? new Date(String(formData.get("contractDeadlineDate")))
            : null,
          nights: tenantType === "daily" ? nights : null,
          checkoutDate: tenantType === "daily" ? checkoutDate : null,
          note: String(formData.get("note") || "").trim() || null,
          status: "pending",
          createdBy: user.id,
        },
      }),
    ];
    // ห้อง "ว่าง" เท่านั้นที่เปลี่ยนเป็น "จองแล้ว" — ถ้าห้องถูกใช้งานอยู่แล้ว (occupied/maintenance) ไม่แตะสถานะห้อง
    if (room.status === "available") {
      ops.push(prisma.room.update({ where: { id: roomId }, data: { status: "reserved" } }));
    }
    await prisma.$transaction(ops);
  } else {
    const plannedCheckoutDate =
      tenantType === "monthly" && formData.get("plannedCheckoutDate")
        ? new Date(String(formData.get("plannedCheckoutDate")))
        : null;
    const depositAmount = formData.get("depositAmount") ? Number(formData.get("depositAmount")) : null;

    const ops: any[] = [
      prisma.roomOccupancy.create({
        data: { tenantId, roomId, checkinDate, plannedCheckoutDate, depositAmount, status: "active" },
      }),
      prisma.room.update({ where: { id: roomId }, data: { status: "occupied" } }),
    ];

    const waterCurrent = formData.get("initialWater") ? Number(formData.get("initialWater")) : null;
    const electricCurrent = formData.get("initialElectric") ? Number(formData.get("initialElectric")) : null;
    if (waterCurrent !== null || electricCurrent !== null) {
      ops.push(
        prisma.meterReading.create({
          data: {
            roomId,
            buildingId: building.id,
            readingMonth: monthKey(checkinDate),
            waterPrev: waterCurrent ?? 0,
            waterCurrent: waterCurrent ?? 0,
            waterUnits: 0,
            electricPrev: electricCurrent ?? 0,
            electricCurrent: electricCurrent ?? 0,
            electricUnits: 0,
            recordedBy: user.id,
          },
        })
      );
    }

    if (bookingId) {
      ops.push(
        prisma.booking.update({
          where: { id: bookingId },
          data: { status: "completed", checkedInAt: new Date(), checkedInBy: user.id },
        })
      );
    }

    await prisma.$transaction(ops);
  }

  revalidatePath("/rooms");
}

export async function checkoutTenant(formData: FormData) {
  await requireAccess("room");
  const occupancyId = Number(formData.get("occupancyId"));
  const occupancy = await prisma.roomOccupancy.findUnique({ where: { id: occupancyId } });
  if (!occupancy || occupancy.status !== "active") return { error: "ไม่พบข้อมูลการเข้าพัก" };

  const movedOutDate = formData.get("movedOutDate") ? new Date(String(formData.get("movedOutDate"))) : new Date();
  const movedOutReason = String(formData.get("movedOutReason") || "").trim() || null;

  await prisma.$transaction([
    prisma.roomOccupancy.update({
      where: { id: occupancyId },
      data: { status: "moved_out", movedOutDate, movedOutReason },
    }),
    prisma.room.update({ where: { id: occupancy.roomId }, data: { status: "available" } }),
  ]);

  revalidatePath("/rooms");
}

export async function cancelBookingFromRoom(formData: FormData) {
  const { user } = await requireAccess("room");
  if (user.role !== "owner") return { error: "ยกเลิกการจองได้เฉพาะเจ้าของระบบเท่านั้น" };

  const bookingId = Number(formData.get("bookingId"));
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { error: "ไม่พบรายการจอง" };

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: { status: "cancelled", cancelReason: String(formData.get("cancelReason") || "").trim() || null },
    }),
    prisma.room.update({ where: { id: booking.roomId }, data: { status: "available" } }),
  ]);

  revalidatePath("/rooms");
}
