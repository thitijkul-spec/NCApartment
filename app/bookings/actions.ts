"use server";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { revalidatePath } from "next/cache";

// หมายเหตุ: Booking ไม่มี field depositAmount เก็บเอง — ยอดมัดจำคำนวณสดจาก SUM(BookingPayment.amount) เสมอ (ดู module_booking spec)

export async function cancelBooking(formData: FormData) {
  const { user, building } = await requireAccess("room");
  if (user.role !== "owner") return { error: "ยกเลิกการจองได้เฉพาะเจ้าของระบบเท่านั้น" };

  const id = Number(formData.get("bookingId"));
  const booking = await prisma.booking.findFirst({ where: { id, buildingId: building.id } });
  if (!booking) return { error: "ไม่พบรายการจอง" };

  const depositRefunded = formData.get("depositRefunded") === "on";

  const ops: any[] = [
    prisma.booking.update({
      where: { id },
      data: {
        status: "cancelled",
        cancelReason: String(formData.get("cancelReason") || "").trim() || null,
        depositRefunded,
      },
    }),
  ];
  if (booking.roomId) {
    ops.push(prisma.room.updateMany({ where: { id: booking.roomId, status: "reserved" }, data: { status: "available" } }));
  }
  await prisma.$transaction(ops);

  revalidatePath("/bookings");
  revalidatePath("/rooms");
}

// ยืนยันจอง — แค่ staff ตรวจสอบความถูกต้องแล้ว (เช่น เช็คสลิป) ไม่ผูกกับการจ่ายเงิน — จ่ายเงินตอนไหนก็ได้ไม่บล็อกการยืนยัน (ตามสเปค module_booking)
export async function confirmBooking(formData: FormData) {
  const { building } = await requireAccess("room");
  const id = Number(formData.get("bookingId"));
  const booking = await prisma.booking.findFirst({ where: { id, buildingId: building.id } });
  if (!booking) return { error: "ไม่พบรายการจอง" };
  if (booking.status !== "pending") return { error: "ยืนยันได้เฉพาะรายการที่ยังรอยืนยัน" };

  await prisma.booking.update({ where: { id }, data: { status: "confirmed" } });
  revalidatePath("/bookings");
}

// เลือก/เปลี่ยนห้องให้รายการจองที่ยังไม่ได้เลือกห้องตอนสร้าง (ลูกค้าเข้ามาตอนที่ยังไม่รู้ว่าห้องไหนว่าง)
export async function assignBookingRoom(formData: FormData) {
  const { building } = await requireAccess("room");
  const id = Number(formData.get("bookingId"));
  const roomId = Number(formData.get("roomId"));
  if (!roomId) return { error: "กรุณาเลือกห้อง" };

  const booking = await prisma.booking.findFirst({ where: { id, buildingId: building.id } });
  if (!booking) return { error: "ไม่พบรายการจอง" };
  if (booking.status !== "pending" && booking.status !== "confirmed") {
    return { error: "แก้ไขไม่ได้ — รายการนี้เช็คอิน/ยกเลิกไปแล้ว" };
  }

  const room = await prisma.room.findFirst({ where: { id: roomId, buildingId: building.id } });
  if (!room) return { error: "ไม่พบห้อง" };

  const ops: any[] = [prisma.booking.update({ where: { id }, data: { roomId } })];
  if (room.status === "available") {
    ops.push(prisma.room.update({ where: { id: roomId }, data: { status: "reserved" } }));
  }
  await prisma.$transaction(ops);

  revalidatePath("/bookings");
  revalidatePath("/rooms");
}

export async function editBooking(formData: FormData) {
  const { building } = await requireAccess("room");
  const id = Number(formData.get("bookingId"));
  const booking = await prisma.booking.findFirst({ where: { id, buildingId: building.id } });
  if (!booking) return { error: "ไม่พบรายการจอง" };
  if (booking.status !== "pending" && booking.status !== "confirmed") {
    return { error: "แก้ไขไม่ได้ — รายการนี้เช็คอิน/ยกเลิกไปแล้ว" };
  }

  const checkinDate = new Date(String(formData.get("checkinDate")));
  if (isNaN(checkinDate.getTime())) return { error: "กรุณาระบุวันเข้าพัก" };

  await prisma.booking.update({
    where: { id },
    data: {
      checkinDate,
      contractDeadlineDate: formData.get("contractDeadlineDate") ? new Date(String(formData.get("contractDeadlineDate"))) : null,
      nights: booking.bookingType === "daily" && formData.get("nights") ? Number(formData.get("nights")) : booking.nights,
      checkoutDate: booking.bookingType === "daily" && formData.get("checkoutDate") ? new Date(String(formData.get("checkoutDate"))) : booking.checkoutDate,
      note: String(formData.get("note") || "").trim() || null,
    },
  });

  revalidatePath("/bookings");
}

export async function archiveBooking(formData: FormData) {
  const { building } = await requireAccess("room");
  const id = Number(formData.get("bookingId"));
  await prisma.booking.updateMany({
    where: { id, buildingId: building.id, status: { in: ["completed", "cancelled"] } },
    data: { archivedAt: new Date() },
  });
  revalidatePath("/bookings");
}

export async function addBookingPayment(formData: FormData) {
  await requireAccess("room");
  const bookingId = Number(formData.get("bookingId"));
  const amount = Number(formData.get("amount"));
  if (!amount || amount <= 0) return { error: "กรุณากรอกจำนวนเงิน" };

  const method = String(formData.get("method") || "cash");
  const accountId = formData.get("accountId") ? Number(formData.get("accountId")) : null;
  if (method === "transfer" && !accountId) return { error: "กรุณาเลือกบัญชีที่โอนเข้า" };

  await prisma.bookingPayment.create({
    data: { bookingId, method, accountId, amount, slipUrl: null },
  });
  revalidatePath("/bookings");
}

export async function deleteBookingPayment(formData: FormData) {
  const { building } = await requireAccess("room");
  const id = Number(formData.get("paymentId"));
  const existing = await prisma.bookingPayment.findFirst({ where: { id, booking: { buildingId: building.id } } });
  if (!existing) return { error: "ไม่พบรายการชำระเงิน" };
  await prisma.bookingPayment.delete({ where: { id } });
  revalidatePath("/bookings");
}
