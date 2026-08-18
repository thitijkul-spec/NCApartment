"use server";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { saveUploadedFile } from "@/lib/upload";
import { logAudit } from "@/lib/audit";
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

// จองล่วงหน้า (isReservation) เลือกยังไม่รู้ห้องได้ — ลูกค้าเดินเข้ามาตอนที่ยังไม่รู้ว่าห้องไหนว่าง
function readBookingPayments(formData: FormData) {
  const methods = formData.getAll("paymentMethod").map(String);
  const accountIds = formData.getAll("paymentAccountId").map(String);
  const amounts = formData.getAll("paymentAmount").map(String);
  return methods
    .map((method, i) => ({
      method,
      accountId: accountIds[i] ? Number(accountIds[i]) : null,
      amount: Number(amounts[i]) || 0,
    }))
    .filter((p) => p.amount > 0);
}

export async function checkInTenant(formData: FormData) {
  const { user, building } = await requireAccess("room");

  const isReservation = formData.get("isReservation") === "on";
  const roomIdRaw = formData.get("roomId");
  const roomId = roomIdRaw ? Number(roomIdRaw) : null;

  let room: Awaited<ReturnType<typeof prisma.room.findFirst>> = null;
  if (roomId) {
    room = await prisma.room.findFirst({ where: { id: roomId, buildingId: building.id } });
    if (!room) return { error: "ไม่พบห้อง" };
    // จองล่วงหน้าเลือกห้องไหนก็ได้ไม่กรองสถานะ (ไม่ป้องกันจอง/เช็คอินซ้อนทับ) — เช็คอินจริงเท่านั้นที่ห้องต้องว่าง/จองแล้วจริงๆ
    if (!isReservation && room.status !== "available" && room.status !== "reserved") {
      return { error: "ห้องนี้ไม่ว่าง ไม่สามารถเพิ่มผู้เช่าได้" };
    }
  } else if (!isReservation) {
    return { error: "กรุณาเลือกห้อง" };
  }

  const tenantType = String(formData.get("tenantType") || "monthly");
  const checkinDate = new Date(String(formData.get("checkinDate")));
  if (isNaN(checkinDate.getTime())) return { error: "กรุณาระบุวันเข้าพัก" };

  const mode = String(formData.get("mode") || "new");
  const bookingId = formData.get("bookingId") ? Number(formData.get("bookingId")) : null;

  let tenantId: number;
  let tenantName: string;
  if (mode === "existing") {
    const existingId = Number(formData.get("existingTenantId"));
    const tenant = await prisma.tenant.findFirst({ where: { id: existingId, buildingId: building.id } });
    if (!tenant) return { error: "ไม่พบผู้เช่าที่เลือก" };
    await prisma.tenant.update({ where: { id: tenant.id }, data: { tenantType } });
    tenantId = tenant.id;
    tenantName = tenant.name;
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
    tenantName = tenant.name;

    await logAudit({
      buildingId: building.id,
      actorUserId: user.id,
      actorName: user.name,
      actionType: "create",
      moduleTag: "ผู้เช่า",
      entityType: "Tenant",
      entityId: tenant.id,
      entityLabel: tenant.name,
      description: `เพิ่มผู้เช่า ${tenant.name}`,
    });
  }

  if (isReservation) {
    const nights = formData.get("nights") ? Number(formData.get("nights")) : null;
    const checkoutDate = formData.get("checkoutDate") ? new Date(String(formData.get("checkoutDate"))) : null;
    const payments = readBookingPayments(formData);

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
          payments: payments.length > 0 ? { create: payments } : undefined,
        },
      }),
    ];
    // ห้อง "ว่าง" เท่านั้นที่เปลี่ยนเป็น "จองแล้ว" — ถ้าห้องถูกใช้งานอยู่แล้ว (occupied/maintenance) ไม่แตะสถานะห้อง — ถ้ายังไม่เลือกห้องก็ข้ามไปก่อน
    if (room && room.status === "available") {
      ops.push(prisma.room.update({ where: { id: roomId as number }, data: { status: "reserved" } }));
    }
    const [booking] = await prisma.$transaction(ops);
    await logAudit({
      buildingId: building.id,
      actorUserId: user.id,
      actorName: user.name,
      actionType: "create",
      moduleTag: "จองห้อง",
      entityType: "Booking",
      entityId: (booking as { id: number }).id,
      entityLabel: `${room ? `ห้อง ${room.roomNumber}` : "ยังไม่เลือกห้อง"} — ${tenantName}`,
      description: `สร้างการจองห้อง ${room ? room.roomNumber : "(ยังไม่เลือกห้อง)"} — ${tenantName}`,
    });
  } else {
    const roomIdSafe = roomId as number; // การันตี non-null แล้วด้วย guard ด้านบน (ไม่ isReservation ต้องมีห้องเสมอ)
    const plannedCheckoutDate =
      tenantType === "monthly" && formData.get("plannedCheckoutDate")
        ? new Date(String(formData.get("plannedCheckoutDate")))
        : null;
    const depositAmount = formData.get("depositAmount") ? Number(formData.get("depositAmount")) : null;

    const ops: any[] = [
      prisma.roomOccupancy.create({
        data: { tenantId, roomId: roomIdSafe, checkinDate, plannedCheckoutDate, depositAmount, status: "active" },
      }),
      prisma.room.update({ where: { id: roomIdSafe }, data: { status: "occupied" } }),
    ];

    const waterCurrent = formData.get("initialWater") ? Number(formData.get("initialWater")) : null;
    const electricCurrent = formData.get("initialElectric") ? Number(formData.get("initialElectric")) : null;
    if (waterCurrent !== null || electricCurrent !== null) {
      ops.push(
        prisma.meterReading.create({
          data: {
            roomId: roomIdSafe,
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

    const results = await prisma.$transaction(ops);
    const occupancyId = (results[0] as { id: number }).id;

    await logAudit({
      buildingId: building.id,
      actorUserId: user.id,
      actorName: user.name,
      actionType: "status_change",
      moduleTag: "ผู้เช่า",
      entityType: "RoomOccupancy",
      entityId: occupancyId,
      entityLabel: `ห้อง ${room?.roomNumber ?? roomIdSafe} — ${tenantName}`,
      description: `มอบหมายห้อง ${room?.roomNumber ?? roomIdSafe} ให้ผู้เช่า ${tenantName}`,
    });

    revalidatePath("/rooms");
    return { success: true, occupancyId };
  }

  revalidatePath("/rooms");
}

// เช็คอินตรงจากรายการจอง — ใช้ข้อมูลผู้เช่า/วันที่/มัดจำที่มีอยู่แล้วในรายการจองทั้งหมด ไม่ต้องกรอกซ้ำหรือยืนยันซ้ำ
// เงินมัดจำ = ยอดรวมที่บันทึกไว้แล้วใน BookingPayment (ผูกวิธีชำระ/บัญชีไว้ตั้งแต่ตอนจอง)
export async function checkInFromBooking(formData: FormData) {
  const { user, building } = await requireAccess("room");
  const bookingId = Number(formData.get("bookingId"));

  const booking = await prisma.booking.findFirst({
    where: { id: bookingId, buildingId: building.id },
    include: { payments: true },
  });
  if (!booking) return { error: "ไม่พบรายการจอง" };
  if (booking.status !== "pending" && booking.status !== "confirmed") {
    return { error: "รายการนี้เช็คอิน/ยกเลิกไปแล้ว" };
  }
  if (!booking.tenantId) return { error: "รายการจองนี้ไม่มีผู้เช่าผูกไว้" };

  // ถ้าตอนจองยังไม่ได้เลือกห้อง ให้เลือกตอนเช็คอินได้เลย
  const roomId = booking.roomId ?? (formData.get("roomId") ? Number(formData.get("roomId")) : null);
  if (!roomId) return { error: "กรุณาเลือกห้อง" };

  const room = await prisma.room.findFirst({ where: { id: roomId, buildingId: building.id } });
  if (!room) return { error: "ไม่พบห้อง" };
  if (room.status !== "available" && room.status !== "reserved") {
    return { error: "ห้องนี้ไม่ว่าง ไม่สามารถเช็คอินได้" };
  }

  const depositAmount = booking.payments.reduce((s, p) => s + p.amount, 0) || null;

  await prisma.$transaction([
    prisma.tenant.update({ where: { id: booking.tenantId }, data: { tenantType: booking.bookingType } }),
    prisma.roomOccupancy.create({
      data: {
        tenantId: booking.tenantId,
        roomId,
        checkinDate: booking.checkinDate,
        depositAmount,
        status: "active",
      },
    }),
    prisma.room.update({ where: { id: roomId }, data: { status: "occupied" } }),
    prisma.booking.update({
      where: { id: booking.id },
      data: { status: "completed", checkedInAt: new Date(), checkedInBy: user.id, roomId },
    }),
  ]);

  revalidatePath("/rooms");
  revalidatePath("/bookings");
}

// ยกเลิกการเช็คอิน (เผื่อพนักงานกดเช็คอินผิดห้อง/ผิดคน) — ใช้ได้เฉพาะตอนที่ยังไม่มีสัญญาผูกกับการเข้าพักนี้
// คืนสถานะห้อง + รายการจอง (ถ้ามี) กลับไปเหมือนก่อนเช็คอิน แล้วลบ record การเข้าพักทิ้ง
export async function undoCheckIn(formData: FormData) {
  const { building } = await requireAccess("room");
  const occupancyId = Number(formData.get("occupancyId"));

  const occupancy = await prisma.roomOccupancy.findUnique({
    where: { id: occupancyId },
    include: { room: true, contracts: true },
  });
  if (!occupancy || occupancy.status !== "active") return { error: "ไม่พบข้อมูลการเข้าพัก" };
  if (occupancy.room.buildingId !== building.id) return { error: "ไม่พบข้อมูลการเข้าพัก" };
  if (occupancy.contracts.length > 0) {
    return { error: "มีสัญญาผูกกับการเข้าพักนี้แล้ว ยกเลิกเช็คอินไม่ได้ — กรุณาใช้เมนูเช็คเอาท์แทน" };
  }

  const booking = await prisma.booking.findFirst({
    where: { roomId: occupancy.roomId, tenantId: occupancy.tenantId, status: "completed", checkedInAt: { not: null } },
    orderBy: { checkedInAt: "desc" },
  });

  const ops: any[] = [
    prisma.roomOccupancy.delete({ where: { id: occupancyId } }),
    prisma.room.update({ where: { id: occupancy.roomId }, data: { status: booking ? "reserved" : "available" } }),
  ];
  if (booking) {
    ops.push(
      prisma.booking.update({
        where: { id: booking.id },
        data: { status: "confirmed", checkedInAt: null, checkedInBy: null },
      })
    );
  }
  await prisma.$transaction(ops);

  revalidatePath("/rooms");
  revalidatePath("/bookings");
}

export async function checkoutTenant(formData: FormData) {
  const { building } = await requireAccess("room");
  const occupancyId = Number(formData.get("occupancyId"));
  const occupancy = await prisma.roomOccupancy.findUnique({ where: { id: occupancyId }, include: { room: true } });
  if (!occupancy || occupancy.status !== "active") return { error: "ไม่พบข้อมูลการเข้าพัก" };
  if (occupancy.room.buildingId !== building.id) return { error: "ไม่พบข้อมูลการเข้าพัก" };

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
  const { user, building } = await requireAccess("room");
  if (user.role !== "owner") return { error: "ยกเลิกการจองได้เฉพาะเจ้าของระบบเท่านั้น" };

  const bookingId = Number(formData.get("bookingId"));
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { room: true } });
  if (!booking) return { error: "ไม่พบรายการจอง" };

  const ops: any[] = [
    prisma.booking.update({
      where: { id: bookingId },
      data: { status: "cancelled", cancelReason: String(formData.get("cancelReason") || "").trim() || null },
    }),
  ];
  if (booking.roomId) {
    ops.push(prisma.room.update({ where: { id: booking.roomId }, data: { status: "available" } }));
  }
  await prisma.$transaction(ops);

  const roomLabel = booking.room?.roomNumber ?? "(ยังไม่เลือกห้อง)";
  await logAudit({
    buildingId: building.id,
    actorUserId: user.id,
    actorName: user.name,
    actionType: "delete",
    moduleTag: "จองห้อง",
    entityType: "Booking",
    entityId: bookingId,
    entityLabel: `ห้อง ${roomLabel}`,
    description: `ยกเลิกการจองห้อง ${roomLabel}`,
  });

  revalidatePath("/rooms");
}
