"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function nightsBetween(checkin: Date, checkout: Date) {
  const ms = checkout.getTime() - checkin.getTime();
  return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export async function createBooking(formData: FormData) {
  const roomId = Number(formData.get("roomId"));
  const customerId = Number(formData.get("customerId"));
  const checkinDate = new Date(String(formData.get("checkinDate")));
  const checkoutDate = new Date(String(formData.get("checkoutDate")));
  const pricePerNight = Number(formData.get("pricePerNight") || 0);
  const discountAmount = Number(formData.get("discountAmount") || 0);
  const discountReason = String(formData.get("discountReason") || "").trim();
  const depositPaid = Number(formData.get("depositPaid") || 0);
  const bookingType = String(formData.get("bookingType") || "walkin");
  const paymentTiming = String(formData.get("paymentTiming") || "pay_before_checkin");

  if (!roomId || !customerId || !checkinDate.getTime() || !checkoutDate.getTime()) return;

  const nights = nightsBetween(checkinDate, checkoutDate);
  const baseAmount = pricePerNight * nights;
  const totalAmount = Math.max(0, baseAmount - discountAmount);

  await prisma.booking.create({
    data: {
      roomId,
      customerId,
      checkinDate,
      checkoutDate,
      nights,
      bookingType,
      paymentTiming,
      baseAmount,
      discountAmount,
      discountReason: discountReason || null,
      totalAmount,
      depositPaid,
      status: "booked",
    },
  });

  revalidatePath("/bookings");
}

export async function setBookingStatus(bookingId: number, status: string) {
  const booking = await prisma.booking.update({
    where: { id: bookingId },
    data: { status },
  });

  if (status === "checked_in") {
    await prisma.room.update({ where: { id: booking.roomId }, data: { status: "unavailable" } });
  } else if (["checked_out", "cancelled", "no_show"].includes(status)) {
    await prisma.room.update({ where: { id: booking.roomId }, data: { status: "available" } });
  }

  revalidatePath("/bookings");
  revalidatePath("/rooms");
}
