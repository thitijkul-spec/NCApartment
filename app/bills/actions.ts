"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { getDefaultBranch } from "../rooms/actions";

export async function createMonthlyBill(formData: FormData) {
  const branch = await getDefaultBranch();
  const contractId = Number(formData.get("contractId"));
  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) return;

  const billingPeriodStart = new Date(String(formData.get("billingPeriodStart")));
  const billingPeriodEnd = new Date(String(formData.get("billingPeriodEnd")));
  const dueDate = new Date(String(formData.get("dueDate")));
  if (!billingPeriodStart.getTime() || !billingPeriodEnd.getTime() || !dueDate.getTime()) return;

  const roomChargeInput = formData.get("roomCharge");
  const roomCharge = roomChargeInput ? Number(roomChargeInput) : contract.monthlyRate;
  const waterCharge = Number(formData.get("waterCharge") || 0);
  const electricCharge = Number(formData.get("electricCharge") || 0);
  const otherCharges = Number(formData.get("otherCharges") || 0);
  const otherChargesNote = String(formData.get("otherChargesNote") || "").trim();
  const discountAmount = Number(formData.get("discountAmount") || 0);

  const totalAmount = Math.max(
    0,
    roomCharge + waterCharge + electricCharge + otherCharges - discountAmount
  );

  await prisma.bill.create({
    data: {
      branchId: branch.id,
      billType: "monthly",
      contractId: contract.id,
      customerId: contract.customerId,
      roomId: contract.roomId,
      billingPeriodStart,
      billingPeriodEnd,
      roomCharge,
      waterCharge,
      electricCharge,
      otherCharges,
      otherChargesNote: otherChargesNote || null,
      discountAmount,
      totalAmount,
      dueDate,
      status: "issued",
    },
  });

  revalidatePath("/bills");
}

export async function createDailyBill(formData: FormData) {
  const branch = await getDefaultBranch();
  const bookingId = Number(formData.get("bookingId"));
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return;

  const dueDate = new Date(String(formData.get("dueDate")));
  if (!dueDate.getTime()) return;

  const otherCharges = Number(formData.get("otherCharges") || 0);
  const otherChargesNote = String(formData.get("otherChargesNote") || "").trim();
  const discountAmount = Number(formData.get("discountAmount") || 0);
  const roomCharge = booking.totalAmount;
  const totalAmount = Math.max(0, roomCharge + otherCharges - discountAmount);

  await prisma.bill.create({
    data: {
      branchId: branch.id,
      billType: "daily",
      bookingId: booking.id,
      customerId: booking.customerId,
      roomId: booking.roomId,
      billingPeriodStart: booking.checkinDate,
      billingPeriodEnd: booking.checkoutDate,
      roomCharge,
      otherCharges,
      otherChargesNote: otherChargesNote || null,
      discountAmount,
      totalAmount,
      dueDate,
      status: "issued",
    },
  });

  revalidatePath("/bills");
}

export async function addPayment(formData: FormData) {
  const billId = Number(formData.get("billId"));
  const amount = Number(formData.get("amount"));
  const paymentDate = new Date(String(formData.get("paymentDate")));
  const paymentMethod = String(formData.get("paymentMethod") || "cash");
  const note = String(formData.get("note") || "").trim();

  if (!billId || !amount || !paymentDate.getTime()) return;

  await prisma.payment.create({
    data: { billId, amount, paymentDate, paymentMethod, note: note || null },
  });

  const bill = await prisma.bill.findUnique({
    where: { id: billId },
    include: { payments: true },
  });
  if (bill) {
    const totalPaid = bill.payments.reduce((sum, p) => sum + p.amount, 0);
    const status = totalPaid >= bill.totalAmount ? "paid" : totalPaid > 0 ? "partial" : "issued";
    await prisma.bill.update({ where: { id: billId }, data: { status } });
  }

  revalidatePath(`/bills/${billId}`);
  revalidatePath("/bills");
}

export async function cancelBill(billId: number) {
  await prisma.bill.update({ where: { id: billId }, data: { status: "cancelled" } });
  revalidatePath(`/bills/${billId}`);
  revalidatePath("/bills");
}
