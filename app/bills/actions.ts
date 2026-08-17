"use server";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { saveUploadedFile } from "@/lib/upload";
import { generateBillNo, generateReceiptNo, generateTaxInvoiceNo } from "@/lib/bill-numbering";
import { buildMonthlyLineItems, buildMoveInLineItems, billTotal, type DraftLineItem } from "@/lib/bill-calc";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

function dueDateFor(billingMonth: string, paymentDueDay: number) {
  const [year, month] = billingMonth.split("-").map(Number);
  return new Date(year, month - 1, paymentDueDay);
}

async function findContractForOccupancy(occupancyId: number) {
  return prisma.contract.findFirst({ where: { occupancyId, archivedAt: null }, orderBy: { createdAt: "desc" } });
}

async function createBillFromLineItems(
  buildingId: number,
  roomId: number,
  tenantId: number,
  contractId: number,
  billType: string,
  billingMonth: string,
  dueDate: Date,
  lineItems: DraftLineItem[],
  meterReadingIds: number[]
) {
  const billNo = await generateBillNo(buildingId);
  const bill = await prisma.bill.create({
    data: {
      billNo,
      buildingId,
      roomId,
      tenantId,
      contractId,
      billType,
      billingMonth,
      issueDate: new Date(),
      dueDate,
      lineItems: { create: lineItems },
    },
  });
  if (meterReadingIds.length > 0) {
    await prisma.meterReading.updateMany({
      where: { id: { in: meterReadingIds } },
      data: { billingStatus: "billed", billId: bill.id },
    });
  }
  return bill;
}

export async function issueSingleBill(formData: FormData) {
  const { building } = await requireAccess("finance");
  const roomId = Number(formData.get("roomId"));
  const billingMonth = String(formData.get("billingMonth") || "");
  if (!roomId || !billingMonth) return { error: "กรุณาเลือกห้องและเดือนที่ออกบิล" };

  const room = await prisma.room.findFirst({ where: { id: roomId, buildingId: building.id } });
  const occupancy = await prisma.roomOccupancy.findFirst({ where: { roomId, status: "active" }, include: { tenant: true } });
  if (!room || !occupancy) return { error: "ห้องนี้ไม่มีผู้เช่าปัจจุบัน" };

  const existing = await prisma.bill.findFirst({ where: { roomId, billingMonth, status: { not: "cancelled" } } });
  if (existing) return { error: `ห้อง ${room.roomNumber} มีบิลของเดือน ${billingMonth} อยู่แล้ว (${existing.billNo})` };

  const contract = await findContractForOccupancy(occupancy.id);
  if (!contract) return { error: "ห้องนี้ยังไม่มีสัญญาเช่า — กรุณาสร้างสัญญาก่อนออกบิล" };

  const settings = await prisma.buildingSettings.findUnique({ where: { buildingId: building.id } });
  const meterReading = await prisma.meterReading.findFirst({ where: { roomId, billingStatus: "unbilled" }, orderBy: { recordedAt: "desc" } });

  const { lineItems, warnings, meterReadingConsumed } = buildMonthlyLineItems(room, settings, meterReading, contract);
  const bill = await createBillFromLineItems(
    building.id,
    roomId,
    occupancy.tenantId,
    contract.id,
    "monthly",
    billingMonth,
    dueDateFor(billingMonth, contract.paymentDueDay),
    lineItems,
    meterReadingConsumed && meterReading ? [meterReading.id] : []
  );

  revalidatePath("/bills");
  if (warnings.length > 0) return { success: true, warning: warnings.join(" / "), billId: bill.id };
  redirect(`/bills/${bill.id}`);
}

export async function issueBulkBills(formData: FormData) {
  const { building } = await requireAccess("finance");
  const billingMonth = String(formData.get("billingMonth") || "");
  if (!billingMonth) return { error: "กรุณาระบุเดือนที่ออกบิล" };

  const settings = await prisma.buildingSettings.findUnique({ where: { buildingId: building.id } });
  const occupancies = await prisma.roomOccupancy.findMany({
    where: { status: "active", room: { buildingId: building.id } },
    include: { room: true, tenant: true },
  });

  let issued = 0;
  const skipped: string[] = [];

  for (const occ of occupancies) {
    if (occ.tenant.tenantType !== "monthly") continue;
    const existing = await prisma.bill.findFirst({ where: { roomId: occ.roomId, billingMonth, status: { not: "cancelled" } } });
    if (existing) {
      skipped.push(`ห้อง ${occ.room.roomNumber}: มีบิลเดือนนี้แล้ว`);
      continue;
    }
    const contract = await findContractForOccupancy(occ.id);
    if (!contract) {
      skipped.push(`ห้อง ${occ.room.roomNumber}: ยังไม่มีสัญญาเช่า`);
      continue;
    }
    const meterReading = await prisma.meterReading.findFirst({
      where: { roomId: occ.roomId, billingStatus: "unbilled" },
      orderBy: { recordedAt: "desc" },
    });
    const { lineItems, warnings, meterReadingConsumed } = buildMonthlyLineItems(occ.room, settings, meterReading, contract);
    await createBillFromLineItems(
      building.id,
      occ.roomId,
      occ.tenantId,
      contract.id,
      "monthly",
      billingMonth,
      dueDateFor(billingMonth, contract.paymentDueDay),
      lineItems,
      meterReadingConsumed && meterReading ? [meterReading.id] : []
    );
    issued++;
    if (warnings.length > 0) skipped.push(`ห้อง ${occ.room.roomNumber}: ${warnings.join(", ")} (ออกบิลแล้วแต่ไม่รวมรายการนี้)`);
  }

  revalidatePath("/bills");
  return { success: true, issued, skipped };
}

export async function issueMoveInBill(formData: FormData) {
  const { building } = await requireAccess("finance");
  const contractId = Number(formData.get("contractId"));
  const contract = await prisma.contract.findFirst({ where: { id: contractId, buildingId: building.id } });
  if (!contract) return { error: "ไม่พบสัญญา" };

  const billingMonth = `${contract.startDate.getFullYear()}-${String(contract.startDate.getMonth() + 1).padStart(2, "0")}`;
  const lineItems = buildMoveInLineItems(contract);
  const bill = await createBillFromLineItems(
    building.id,
    contract.roomId,
    contract.tenantId,
    contract.id,
    "move_in",
    billingMonth,
    dueDateFor(billingMonth, contract.paymentDueDay),
    lineItems,
    []
  );

  revalidatePath("/bills");
  redirect(`/bills/${bill.id}`);
}

export async function addLateFee(formData: FormData) {
  await requireAccess("finance");
  const billId = Number(formData.get("billId"));
  const amount = Number(formData.get("amount"));
  if (!amount || amount <= 0) return { error: "กรุณากรอกจำนวนเงิน" };

  await prisma.billLineItem.create({
    data: { billId, itemType: "late_fee", description: "ค่าปรับชำระล่าช้า", amount },
  });
  revalidatePath(`/bills/${billId}`);
}

async function recomputeBillStatus(billId: number) {
  const bill = await prisma.bill.findUnique({ where: { id: billId }, include: { lineItems: true, payments: true } });
  if (!bill || bill.status === "cancelled") return;
  const total = billTotal(bill.lineItems, bill.discountAmount);
  const paid = bill.payments.reduce((s, p) => s + p.amount, 0);
  const status = paid <= 0 ? "unpaid" : paid < total ? "partially_paid" : "paid";
  await prisma.bill.update({ where: { id: billId }, data: { status } });
}

export async function addPayment(formData: FormData) {
  const { building } = await requireAccess("finance");
  const billId = Number(formData.get("billId"));
  const bill = await prisma.bill.findFirst({ where: { id: billId, buildingId: building.id } });
  if (!bill) return { error: "ไม่พบบิล" };
  if (bill.status === "cancelled") return { error: "บิลนี้ถูกยกเลิกแล้ว" };

  const amount = Number(formData.get("amount"));
  if (!amount || amount <= 0) return { error: "กรุณากรอกจำนวนเงิน" };

  const method = String(formData.get("method") || "cash");
  const accountId = formData.get("accountId") ? Number(formData.get("accountId")) : null;
  if (method === "transfer" && !accountId) return { error: "กรุณาเลือกบัญชีที่โอนเข้า" };

  const issueTaxInvoice = formData.get("issueTaxInvoice") === "on";
  const taxpayerTaxId = String(formData.get("taxpayerTaxId") || "").trim();
  if (issueTaxInvoice) {
    if (!/^\d{13}$/.test(taxpayerTaxId)) return { error: "เลขผู้เสียภาษีต้องมี 13 หลัก" };
  }

  const slipImage = await saveUploadedFile(formData.get("slipImage") as File | null, "slips");
  const payee = await prisma.buildingPayeeSettings.findUnique({ where: { buildingId: building.id } });

  const receiptNo = await generateReceiptNo(building.id);
  const taxInvoiceNo = issueTaxInvoice ? await generateTaxInvoiceNo(building.id) : null;

  await prisma.payment.create({
    data: {
      billId,
      amount,
      method,
      accountId,
      slipImage,
      issueTaxInvoice,
      taxpayerName: issueTaxInvoice ? String(formData.get("taxpayerName") || "").trim() || null : null,
      taxpayerTaxId: issueTaxInvoice ? taxpayerTaxId : null,
      taxpayerAddress: issueTaxInvoice ? String(formData.get("taxpayerAddress") || "").trim() || null : null,
      receiptNo,
      taxInvoiceNo,
      payeeNameSnapshot: payee?.payeeName ?? null,
      payeeAddressSnapshot: payee?.payeeAddress ?? null,
      payeeTaxIdSnapshot: payee?.payeeIdCardNo ?? null,
    },
  });

  await recomputeBillStatus(billId);
  revalidatePath(`/bills/${billId}`);
  revalidatePath("/bills");
}

export async function deletePayment(formData: FormData) {
  await requireAccess("finance");
  const paymentId = Number(formData.get("paymentId"));
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return;
  await prisma.payment.delete({ where: { id: paymentId } });
  await recomputeBillStatus(payment.billId);
  revalidatePath(`/bills/${payment.billId}`);
  revalidatePath("/bills");
}

export async function cancelBill(formData: FormData) {
  const { building } = await requireAccess("finance");
  const billId = Number(formData.get("billId"));
  const bill = await prisma.bill.findFirst({ where: { id: billId, buildingId: building.id }, include: { payments: true } });
  if (!bill) return { error: "ไม่พบบิล" };
  if (bill.payments.length > 0) {
    return { error: "ยกเลิกไม่ได้ — มีการชำระเงิน/ใบเสร็จผูกอยู่ กรุณาลบใบเสร็จก่อน" };
  }

  await prisma.$transaction([
    prisma.bill.update({ where: { id: billId }, data: { status: "cancelled" } }),
    prisma.meterReading.updateMany({ where: { billId }, data: { billingStatus: "unbilled", billId: null } }),
  ]);

  revalidatePath("/bills");
  revalidatePath(`/bills/${billId}`);
}
