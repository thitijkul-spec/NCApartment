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

export async function createExpense(formData: FormData) {
  const { user, building } = await requireAccess("finance");
  const lineItems = readLineItems(formData);
  if (lineItems.length === 0) return { error: "กรุณาเพิ่มรายการอย่างน้อย 1 รายการ" };

  const purchaseType = String(formData.get("purchaseType") || "cash");
  const dueDateStr = String(formData.get("dueDate") || "");
  if (purchaseType === "credit" && !dueDateStr) return { error: "กรุณาระบุวันครบกำหนด (ซื้อเชื่อ)" };

  const vendorContactId = formData.get("vendorContactId") ? Number(formData.get("vendorContactId")) : null;
  const vendor = vendorContactId ? await prisma.contact.findUnique({ where: { id: vendorContactId } }) : null;

  const files = formData.getAll("receiptImage") as File[];
  const receiptUrls: string[] = [];
  for (const f of files) {
    const url = await saveUploadedFile(f, "expenses");
    if (url) receiptUrls.push(url);
  }

  const totalAmount = lineItems.reduce((s, li) => s + li.totalWithVat, 0);
  const documentNo = await generateMonthlyDocNo("EXP", building.id, (likePrefix) =>
    prisma.expense.count({ where: { buildingId: building.id, documentNo: { startsWith: likePrefix } } })
  );

  const expense = await prisma.expense.create({
    data: {
      buildingId: building.id,
      documentNo,
      vendorContactId,
      vendorNameSnapshot: vendor?.name ?? null,
      vendorTaxIdSnapshot: vendor?.taxId ?? null,
      vendorAddressSnapshot: vendor?.address ?? null,
      roomId: formData.get("roomId") ? Number(formData.get("roomId")) : null,
      date: new Date(String(formData.get("date"))),
      purchaseType,
      dueDate: purchaseType === "credit" ? new Date(dueDateStr) : null,
      vendorInvoiceNo: String(formData.get("vendorInvoiceNo") || "").trim() || null,
      whtAmount: formData.get("whtAmount") ? Number(formData.get("whtAmount")) : null,
      totalAmount,
      receiptImageUrls: receiptUrls.length ? JSON.stringify(receiptUrls) : null,
      notes: String(formData.get("notes") || "").trim() || null,
      lineItems: { create: lineItems },
    },
  });

  if (purchaseType === "cash") {
    const method = String(formData.get("payMethod") || "cash");
    const accountId = formData.get("payAccountId") ? Number(formData.get("payAccountId")) : null;
    if (method !== "cash" || accountId) {
      if (!accountId) return { error: "กรุณาเลือกบัญชีที่จ่ายออก" };
      const payment = await prisma.expensePayment.create({
        data: { expenseId: expense.id, amount: totalAmount, method, accountId, date: new Date() },
      });
      await createLedgerEntry({
        buildingId: building.id,
        accountId,
        direction: "out",
        amount: totalAmount,
        date: new Date(),
        sourceType: "expense_payment",
        sourceId: payment.id,
        description: `จ่ายค่าใช้จ่าย ${documentNo}`,
      });
    }
  }

  await logAudit({
    buildingId: building.id,
    actorUserId: user.id,
    actorName: user.name,
    actionType: "create",
    moduleTag: "ค่าใช้จ่าย",
    entityType: "Expense",
    entityId: expense.id,
    entityLabel: documentNo,
    description: `สร้างรายการค่าใช้จ่าย ${documentNo}`,
  });

  revalidatePath("/expenses");
}

export async function updateExpense(formData: FormData) {
  const { building } = await requireAccess("finance");
  const id = Number(formData.get("expenseId"));
  const existing = await prisma.expense.findFirst({ where: { id, buildingId: building.id } });
  if (!existing) return { error: "ไม่พบรายการ" };

  const lineItems = readLineItems(formData);
  if (lineItems.length === 0) return { error: "กรุณาเพิ่มรายการอย่างน้อย 1 รายการ" };

  const purchaseType = String(formData.get("purchaseType") || "cash");
  const dueDateStr = String(formData.get("dueDate") || "");
  if (purchaseType === "credit" && !dueDateStr) return { error: "กรุณาระบุวันครบกำหนด (ซื้อเชื่อ)" };

  const vendorContactId = formData.get("vendorContactId") ? Number(formData.get("vendorContactId")) : null;
  const vendor = vendorContactId ? await prisma.contact.findUnique({ where: { id: vendorContactId } }) : null;

  const files = formData.getAll("receiptImage") as File[];
  const newReceiptUrls: string[] = [];
  for (const f of files) {
    const url = await saveUploadedFile(f, "expenses");
    if (url) newReceiptUrls.push(url);
  }
  const existingUrls: string[] = existing.receiptImageUrls ? JSON.parse(existing.receiptImageUrls) : [];
  const receiptUrls = [...existingUrls, ...newReceiptUrls];

  const totalAmount = lineItems.reduce((s, li) => s + li.totalWithVat, 0);

  await prisma.$transaction([
    prisma.expenseLineItem.deleteMany({ where: { expenseId: id } }),
    prisma.expense.update({
      where: { id },
      data: {
        vendorContactId,
        vendorNameSnapshot: vendor?.name ?? existing.vendorNameSnapshot,
        vendorTaxIdSnapshot: vendor?.taxId ?? existing.vendorTaxIdSnapshot,
        vendorAddressSnapshot: vendor?.address ?? existing.vendorAddressSnapshot,
        roomId: formData.get("roomId") ? Number(formData.get("roomId")) : null,
        date: new Date(String(formData.get("date"))),
        purchaseType,
        dueDate: purchaseType === "credit" ? new Date(dueDateStr) : null,
        vendorInvoiceNo: String(formData.get("vendorInvoiceNo") || "").trim() || null,
        whtAmount: formData.get("whtAmount") ? Number(formData.get("whtAmount")) : null,
        totalAmount,
        receiptImageUrls: receiptUrls.length ? JSON.stringify(receiptUrls) : null,
        notes: String(formData.get("notes") || "").trim() || null,
        lineItems: { create: lineItems },
      },
    }),
  ]);

  revalidatePath("/expenses");
}

export async function deleteExpense(formData: FormData) {
  const { user, building } = await requireAccess("finance");
  const id = Number(formData.get("expenseId"));
  const existing = await prisma.expense.findFirst({ where: { id, buildingId: building.id }, include: { payments: true } });
  if (!existing) return { error: "ไม่พบรายการ" };

  await prisma.$transaction([
    prisma.ledgerEntry.deleteMany({
      where: { sourceType: "expense_payment", sourceId: { in: existing.payments.map((p) => p.id) } },
    }),
    prisma.expensePayment.deleteMany({ where: { expenseId: id } }),
    prisma.expenseLineItem.deleteMany({ where: { expenseId: id } }),
    prisma.expense.delete({ where: { id } }),
  ]);

  await logAudit({
    buildingId: building.id,
    actorUserId: user.id,
    actorName: user.name,
    actionType: "delete",
    moduleTag: "ค่าใช้จ่าย",
    entityType: "Expense",
    entityId: id,
    entityLabel: existing.documentNo,
    description: `ลบรายการค่าใช้จ่าย ${existing.documentNo}`,
  });

  revalidatePath("/expenses");
}

export async function addExpensePayment(formData: FormData) {
  const { user, building } = await requireAccess("finance");
  const expenseId = Number(formData.get("expenseId"));
  const expense = await prisma.expense.findFirst({ where: { id: expenseId, buildingId: building.id } });
  if (!expense) return { error: "ไม่พบรายการ" };

  const amount = Number(formData.get("amount"));
  if (!amount || amount <= 0) return { error: "กรุณากรอกจำนวนเงิน" };
  const accountId = Number(formData.get("accountId"));
  if (!accountId) return { error: "กรุณาเลือกบัญชี" };

  const slip = await saveUploadedFile(formData.get("slipImage") as File | null, "expenses/slips");

  const payment = await prisma.expensePayment.create({
    data: {
      expenseId,
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
    direction: "out",
    amount,
    date: payment.date,
    sourceType: "expense_payment",
    sourceId: payment.id,
    description: `จ่ายค่าใช้จ่าย ${expense.documentNo}`,
  });

  await logAudit({
    buildingId: building.id,
    actorUserId: user.id,
    actorName: user.name,
    actionType: "payment",
    moduleTag: "ค่าใช้จ่าย",
    entityType: "ExpensePayment",
    entityId: payment.id,
    entityLabel: expense.documentNo,
    description: `บันทึกจ่ายเงินค่าใช้จ่าย ${expense.documentNo} ฿${amount.toLocaleString()}`,
  });

  revalidatePath("/expenses");
}

export async function deleteExpensePayment(formData: FormData) {
  await requireAccess("finance");
  const id = Number(formData.get("paymentId"));
  await prisma.$transaction([
    prisma.ledgerEntry.deleteMany({ where: { sourceType: "expense_payment", sourceId: id } }),
    prisma.expensePayment.delete({ where: { id } }),
  ]);
  revalidatePath("/expenses");
}
