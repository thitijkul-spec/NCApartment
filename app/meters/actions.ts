"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDefaultBranch } from "../rooms/actions";

async function getPreviousReading(roomId: number, meterType: string, beforeMonth: string) {
  const prev = await prisma.meterReading.findFirst({
    where: { roomId, meterType, status: "confirmed", billingMonth: { lt: beforeMonth } },
    orderBy: { billingMonth: "desc" },
  });
  return prev?.currentReading ?? 0;
}

async function getPreviousUnitUsed(roomId: number, meterType: string, beforeMonth: string) {
  const prev = await prisma.meterReading.findFirst({
    where: { roomId, meterType, status: "confirmed", billingMonth: { lt: beforeMonth } },
    orderBy: { billingMonth: "desc" },
  });
  return prev?.unitUsed ?? null;
}

export async function submitMeterBatch(formData: FormData) {
  const branch = await getDefaultBranch();
  const billingMonth = String(formData.get("billingMonth") || "");
  const waterRate = Number(formData.get("waterRate") || 0);
  const electricRate = Number(formData.get("electricRate") || 0);
  if (!billingMonth) return;

  const rooms = await prisma.room.findMany({
    where: { branchId: branch.id, waterElectricMode: "metered", active: true },
  });

  for (const room of rooms) {
    for (const meterType of ["water", "electric"] as const) {
      const raw = formData.get(`${meterType}_${room.id}`);
      if (raw === null || String(raw).trim() === "") continue;
      const currentReading = Number(raw);
      const rate = meterType === "water" ? waterRate : electricRate;
      const previousReading = await getPreviousReading(room.id, meterType, billingMonth);
      const unitUsed = currentReading - previousReading;
      const amount = Math.max(0, unitUsed) * rate;
      const previousUnitUsed = await getPreviousUnitUsed(room.id, meterType, billingMonth);
      const flaggedAbnormal =
        unitUsed < 0 || (previousUnitUsed !== null && previousUnitUsed > 0 && unitUsed > previousUnitUsed * 2);

      await prisma.meterReading.upsert({
        where: {
          roomId_meterType_billingMonth: { roomId: room.id, meterType, billingMonth },
        },
        create: {
          roomId: room.id,
          meterType,
          billingMonth,
          previousReading,
          currentReading,
          unitUsed,
          ratePerUnit: rate,
          amount,
          flaggedAbnormal,
          status: "draft",
        },
        update: {
          currentReading,
          unitUsed,
          ratePerUnit: rate,
          amount,
          flaggedAbnormal,
          status: "draft",
        },
      });
    }
  }

  redirect(`/meters?month=${billingMonth}`);
}

export async function updateDraftReading(formData: FormData) {
  const id = Number(formData.get("readingId"));
  const currentReading = Number(formData.get("currentReading"));
  const reading = await prisma.meterReading.findUnique({ where: { id } });
  if (!reading) return;

  const unitUsed = currentReading - reading.previousReading;
  const amount = Math.max(0, unitUsed) * reading.ratePerUnit;

  await prisma.meterReading.update({
    where: { id },
    data: { currentReading, unitUsed, amount, flaggedAbnormal: unitUsed < 0 },
  });

  revalidatePath("/meters");
}

export async function confirmAndIssueBills(billingMonth: string) {
  const branch = await getDefaultBranch();

  await prisma.meterReading.updateMany({
    where: { billingMonth, status: "draft" },
    data: { status: "confirmed" },
  });

  const readings = await prisma.meterReading.findMany({
    where: { billingMonth, status: "confirmed" },
    include: { room: true },
  });

  const roomIds = Array.from(new Set(readings.map((r) => r.roomId)));

  for (const roomId of roomIds) {
    const contract = await prisma.contract.findFirst({
      where: { roomId, status: "active" },
    });
    if (!contract) continue;

    const periodStart = new Date(`${billingMonth}-01T00:00:00`);
    const periodEnd = new Date(periodStart.getFullYear(), periodStart.getMonth() + 1, 0);

    const existing = await prisma.bill.findFirst({
      where: { contractId: contract.id, billingPeriodStart: periodStart, billType: "monthly" },
    });
    if (existing) continue;

    const waterReading = readings.find((r) => r.roomId === roomId && r.meterType === "water");
    const electricReading = readings.find((r) => r.roomId === roomId && r.meterType === "electric");
    const waterCharge = waterReading?.amount ?? 0;
    const electricCharge = electricReading?.amount ?? 0;
    const roomCharge = contract.monthlyRate;
    const totalAmount = roomCharge + waterCharge + electricCharge;
    const dueDate = new Date(periodEnd);
    dueDate.setDate(dueDate.getDate() + 5);

    await prisma.bill.create({
      data: {
        branchId: branch.id,
        billType: "monthly",
        contractId: contract.id,
        customerId: contract.customerId,
        roomId,
        billingPeriodStart: periodStart,
        billingPeriodEnd: periodEnd,
        roomCharge,
        waterCharge,
        electricCharge,
        totalAmount,
        dueDate,
        status: "issued",
      },
    });
  }

  revalidatePath("/meters");
  revalidatePath("/bills");
}

export async function revertBatch(billingMonth: string) {
  const bills = await prisma.bill.findMany({
    where: {
      billType: "monthly",
      billingPeriodStart: new Date(`${billingMonth}-01T00:00:00`),
    },
    include: { payments: true },
  });

  const blockedRoomIds: number[] = [];
  for (const bill of bills) {
    if (bill.payments.length > 0) {
      blockedRoomIds.push(bill.roomId);
    } else {
      await prisma.bill.delete({ where: { id: bill.id } });
    }
  }

  await prisma.meterReading.updateMany({
    where: {
      billingMonth,
      status: "confirmed",
      roomId: { notIn: blockedRoomIds },
    },
    data: { status: "editable" },
  });

  revalidatePath("/meters");
  revalidatePath("/bills");
}
