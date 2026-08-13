"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

function isValidDate(d: Date) {
  return !isNaN(d.getTime()) && d.getFullYear() >= 1900 && d.getFullYear() <= 2200;
}

export async function createContract(formData: FormData) {
  const roomId = Number(formData.get("roomId"));
  const customerId = Number(formData.get("customerId"));
  const startDate = new Date(String(formData.get("startDate")));
  const endDate = new Date(String(formData.get("endDate")));
  const monthlyRate = Number(formData.get("monthlyRate") || 0);
  const depositAmount = Number(formData.get("depositAmount") || 0);

  if (!roomId || !customerId || !isValidDate(startDate) || !isValidDate(endDate)) return;

  await prisma.contract.create({
    data: {
      roomId,
      customerId,
      startDate,
      endDate,
      monthlyRate,
      depositAmount,
      status: "active",
    },
  });

  await prisma.room.update({ where: { id: roomId }, data: { status: "unavailable" } });

  revalidatePath(`/customers/${customerId}`);
  revalidatePath("/rooms");
}

export async function setContractStatus(contractId: number, status: string) {
  const contract = await prisma.contract.update({
    where: { id: contractId },
    data: { status },
  });

  if (status === "ended" || status === "terminated") {
    await prisma.room.update({ where: { id: contract.roomId }, data: { status: "available" } });
  } else if (status === "active") {
    await prisma.room.update({ where: { id: contract.roomId }, data: { status: "unavailable" } });
  }

  revalidatePath(`/customers/${contract.customerId}`);
  revalidatePath("/rooms");
}
