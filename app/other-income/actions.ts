"use server";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { saveUploadedFile } from "@/lib/upload";
import { generateMonthlyDocNo } from "@/lib/doc-numbering";
import { calcVat, type VatMode } from "@/lib/vat-calc";
import { createLedgerEntry } from "@/lib/ledger";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

function readLineItems(formData: FormData) {
  const titles = formData.getAll("liTitle").map(String);
  const categories = formData.getAll("liCategory").map(String);
  const amounts = formData.getAll("liAmount").map(Number);
  const vatModes = formData.getAll("liVatMode").map(String) as VatMode[];
  const vatRateStrs = formData.getAll("liVatRate").map(String);
  const descriptions = formData.getAll("liDescription").map(String);

  return titles
    .map((title, i) => {
      const amount = amounts[i] || 0;
      const vatMode = vatModes[i] || "none";
      const vatRate = vatRateStrs[i] !== undefined && vatRateStrs[i] !== "" ? Number(vatRateStrs[i]) : 7;
      const { vatAmount, totalWithVat } = calcVat(amount, vatMode, vatRate);
      return {
        title,
        category: categories[i] || "อื่นๆ",
        amount,
        vatMode,
        vatRate,
        vatAmount,
        totalWithVat,
        description: descriptions[i] || null,
      };
    })
    .filter((li) => li.title.trim() && li.amount > 0);
}

export async function createOtherIncome(formData: FormData) {
  const { user, building } = await requireAccess("finance");
  const lineItems = readLineItems(formData);
  if (lineItems.length === 0) return { error: "กรุณาเพิ่มรายการอย่างน้อย 1 รายการ" };

  const saleType = String(formData.get("saleType") || "cash");
  const dueDateStr = String(formData.get("dueDate") || "");
  if (saleType === "credit" && !dueDateStr) return { error: "กรุณาระบุวันครบกำหนด (ขายเชื่อ)" };

  const buyerType = String(formData.get("buyerType") || "contact");
  let buyerTenantId: number | null = null;
  let buyerContactId: number | null = null;
  let buyerNameSnapshot: string | null = null;
  let buyerTaxIdSnapshot: string | null = null;
  let buyerAddressSnapshot: string | null = null;

  if (buyerType === "tenant") {
    buyerTenantId = Number(formData.get("buyerTenantId"));
    if (!buyerTenantId) return { error: "กรุณาเลือกผู้เช่า" };
    const tenant = await prisma.tenant.findUnique({ where: { id: buyerTenantId } });
    if (!tenant) return { error: "ไม่พบผู้เช่า" };
    buyerNameSnapshot = tenant.name;
    buyerTaxIdSnapshot = tenant.idCardNo;
    buyerAddressSnapshot = tenant.previousAddress;
  } else {
    buyerContactId = formData.get("buyerContactId") ? Number(formData.get("buyerContactId")) : null;
    if (!buyerContactId) return { error: "กรุณาเลือกผู้ซื้อ" };
    const contact = await prisma.contact.findUnique({ where: { id: buyerContactId } });
    if (!contact) return { error: "ไม่พบผู้ซื้อ" };
    buyerNameSnapshot = contact.name;
    buyerTaxIdSnapshot = contact.taxId;
    buyerAddressSnapshot = contact.address;
  }

  const files = formData.getAll("attachment") as File[];
  const attachmentUrls: string[] = [];
  for (const f of files) {
    const url = await saveUploadedFile(f, "other-income");
    if (url) attachmentUrls.push(url);
  }

  const totalAmount = lineItems.reduce((s, li) => s + li.totalWithVat, 0);
  const documentNo = await generateMonthlyDocNo("INC", building.id, (likePrefix) =>
    prisma.otherIncome.count({ where: { buildingId: building.id, documentNo: { startsWith: likePrefix } } })
  );

  const otherIncome = await prisma.otherIncome.create({
    data: {
      buildingId: building.id,
      documentNo,
      buyerType,
      buyerTenantId,
      buyerContactId,
      buyerNameSnapshot,
      buyerTaxIdSnapshot,
      buyerAddressSnapshot,
      roomId: formData.get("roomId") ? Number(formData.get("roomId")) : null,
      date: new Date(String(formData.get("date"))),
      saleType,
      dueDate: saleType === "credit" ? new Date(dueDateStr) : null,
      saleInvoiceNo: String(formData.get("saleInvoiceNo") || "").trim() || null,
      whtAmount: formData.get("whtAmount") ? Number(formData.get("whtAmount")) : null,
      totalAmount,
      attachmentUrls: attachmentUrls.length ? JSON.stringify(attachmentUrls) : null,
      notes: String(formData.get("notes") || "").trim() || null,
      lineItems: { create: lineItems },
    },
  });

  if (saleType === "cash") {
    const method = String(formData.get("payMethod") || "cash");
    const accountId = formData.get("payAccountId") ? Number(formData.get("payAccountId")) : null;
    if (method !== "cash" || accountId) {
      if (!accountId) return { error: "กรุณาเลือกบัญชีที่รับเงินเข้า" };
      const payment = await prisma.otherIncomePayment.create({
        data: { otherIncomeId: otherIncome.id, amount: totalAmount, method, accountId, date: new Date() },
      });
      await createLedgerEntry({
        buildingId: building.id,
        accountId,
        direction: "in",
        amount: totalAmount,
        date: new Date(),
        sourceType: "other_income_payment",
        sourceId: payment.id,
        description: `รับรายได้อื่นๆ ${documentNo}`,
      });
    }
  }

  await logAudit({
    buildingId: building.id,
    actorUserId: user.id,
    actorName: user.name,
    actionType: "create",
    moduleTag: "รายได้อื่นๆ",
    entityType: "OtherIncome",
    entityId: otherIncome.id,
    entityLabel: documentNo,
    description: `สร้างรายการรายได้อื่นๆ ${documentNo}`,
  });

  revalidatePath("/other-income");
}

export async function updateOtherIncome(formData: FormData) {
  const { building } = await requireAccess("finance");
  const id = Number(formData.get("otherIncomeId"));
  const existing = await prisma.otherIncome.findFirst({ where: { id, buildingId: building.id } });
  if (!existing) return { error: "ไม่พบรายการ" };

  const lineItems = readLineItems(formData);
  if (lineItems.length === 0) return { error: "กรุณาเพิ่มรายการอย่างน้อย 1 รายการ" };

  const saleType = String(formData.get("saleType") || "cash");
  const dueDateStr = String(formData.get("dueDate") || "");
  if (saleType === "credit" && !dueDateStr) return { error: "กรุณาระบุวันครบกำหนด (ขายเชื่อ)" };

  const buyerType = String(formData.get("buyerType") || "contact");
  let buyerTenantId: number | null = null;
  let buyerContactId: number | null = null;
  let buyerNameSnapshot: string | null = existing.buyerNameSnapshot;
  let buyerTaxIdSnapshot: string | null = existing.buyerTaxIdSnapshot;
  let buyerAddressSnapshot: string | null = existing.buyerAddressSnapshot;

  if (buyerType === "tenant") {
    buyerTenantId = Number(formData.get("buyerTenantId"));
    if (!buyerTenantId) return { error: "กรุณาเลือกผู้เช่า" };
    const tenant = await prisma.tenant.findUnique({ where: { id: buyerTenantId } });
    if (tenant) {
      buyerNameSnapshot = tenant.name;
      buyerTaxIdSnapshot = tenant.idCardNo;
      buyerAddressSnapshot = tenant.previousAddress;
    }
  } else {
    buyerContactId = formData.get("buyerContactId") ? Number(formData.get("buyerContactId")) : null;
    if (!buyerContactId) return { error: "กรุณาเลือกผู้ซื้อ" };
    const contact = await prisma.contact.findUnique({ where: { id: buyerContactId } });
    if (contact) {
      buyerNameSnapshot = contact.name;
      buyerTaxIdSnapshot = contact.taxId;
      buyerAddressSnapshot = contact.address;
    }
  }

  const files = formData.getAll("attachment") as File[];
  const newUrls: string[] = [];
  for (const f of files) {
    const url = await saveUploadedFile(f, "other-income");
    if (url) newUrls.push(url);
  }
  const existingUrls: string[] = existing.attachmentUrls ? JSON.parse(existing.attachmentUrls) : [];
  const attachmentUrls = [...existingUrls, ...newUrls];

  const totalAmount = lineItems.reduce((s, li) => s + li.totalWithVat, 0);

  await prisma.$transaction([
    prisma.otherIncomeLineItem.deleteMany({ where: { otherIncomeId: id } }),
    prisma.otherIncome.update({
      where: { id },
      data: {
        buyerType,
        buyerTenantId,
        buyerContactId,
        buyerNameSnapshot,
        buyerTaxIdSnapshot,
        buyerAddressSnapshot,
        roomId: formData.get("roomId") ? Number(formData.get("roomId")) : null,
        date: new Date(String(formData.get("date"))),
        saleType,
        dueDate: saleType === "credit" ? new Date(dueDateStr) : null,
        saleInvoiceNo: String(formData.get("saleInvoiceNo") || "").trim() || null,
        whtAmount: formData.get("whtAmount") ? Number(formData.get("whtAmount")) : null,
        totalAmount,
        attachmentUrls: attachmentUrls.length ? JSON.stringify(attachmentUrls) : null,
        notes: String(formData.get("notes") || "").trim() || null,
        lineItems: { create: lineItems },
      },
    }),
  ]);

  revalidatePath("/other-income");
}

export async function deleteOtherIncome(formData: FormData) {
  const { user, building } = await requireAccess("finance");
  const id = Number(formData.get("otherIncomeId"));
  const existing = await prisma.otherIncome.findFirst({ where: { id, buildingId: building.id }, include: { payments: true } });
  if (!existing) return { error: "ไม่พบรายการ" };

  await prisma.$transaction([
    prisma.ledgerEntry.deleteMany({
      where: { sourceType: "other_income_payment", sourceId: { in: existing.payments.map((p) => p.id) } },
    }),
    prisma.otherIncomePayment.deleteMany({ where: { otherIncomeId: id } }),
    prisma.otherIncomeLineItem.deleteMany({ where: { otherIncomeId: id } }),
    prisma.otherIncome.delete({ where: { id } }),
  ]);

  await logAudit({
    buildingId: building.id,
    actorUserId: user.id,
    actorName: user.name,
    actionType: "delete",
    moduleTag: "รายได้อื่นๆ",
    entityType: "OtherIncome",
    entityId: id,
    entityLabel: existing.documentNo,
    description: `ลบรายการรายได้อื่นๆ ${existing.documentNo}`,
  });

  revalidatePath("/other-income");
}

export async function addOtherIncomePayment(formData: FormData) {
  const { user, building } = await requireAccess("finance");
  const otherIncomeId = Number(formData.get("otherIncomeId"));
  const otherIncome = await prisma.otherIncome.findFirst({ where: { id: otherIncomeId, buildingId: building.id } });
  if (!otherIncome) return { error: "ไม่พบรายการ" };

  const amount = Number(formData.get("amount"));
  if (!amount || amount <= 0) return { error: "กรุณากรอกจำนวนเงิน" };
  const accountId = Number(formData.get("accountId"));
  if (!accountId) return { error: "กรุณาเลือกบัญชี" };

  const slip = await saveUploadedFile(formData.get("slipImage") as File | null, "other-income/slips");

  const payment = await prisma.otherIncomePayment.create({
    data: {
      otherIncomeId,
      amount,
      method: String(formData.get("method") || "cash"),
      accountId,
      date: new Date(String(formData.get("date") || new Date())),
      slipImageUrls: slip ? JSON.stringify([slip]) : null,
      notes: String(formData.get("notes") || "").trim() || null,
    },
  });

  await createLedgerEntry({
    buildingId: building.id,
    accountId,
    direction: "in",
    amount,
    date: payment.date,
    sourceType: "other_income_payment",
    sourceId: payment.id,
    description: `รับรายได้อื่นๆ ${otherIncome.documentNo}`,
  });

  await logAudit({
    buildingId: building.id,
    actorUserId: user.id,
    actorName: user.name,
    actionType: "payment",
    moduleTag: "รายได้อื่นๆ",
    entityType: "OtherIncomePayment",
    entityId: payment.id,
    entityLabel: otherIncome.documentNo,
    description: `บันทึกรับเงินรายได้อื่นๆ ${otherIncome.documentNo} ฿${amount.toLocaleString()}`,
  });

  revalidatePath("/other-income");
}

export async function deleteOtherIncomePayment(formData: FormData) {
  await requireAccess("finance");
  const id = Number(formData.get("paymentId"));
  await prisma.$transaction([
    prisma.ledgerEntry.deleteMany({ where: { sourceType: "other_income_payment", sourceId: id } }),
    prisma.otherIncomePayment.delete({ where: { id } }),
  ]);
  revalidatePath("/other-income");
}
