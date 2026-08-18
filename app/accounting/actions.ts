"use server";

import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { getAccountBalance, createLedgerEntry } from "@/lib/ledger";
import { returnDeposit, forfeitDeposit } from "@/lib/deposit-forfeit";
import { generateMonthlyDocNo } from "@/lib/doc-numbering";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";

// ---------- จัดการบัญชี ----------

export async function createAccount(formData: FormData) {
  const { user, building } = await requireAccess("finance");
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "กรุณากรอกชื่อบัญชี" };

  const account = await prisma.account.create({
    data: {
      buildingId: building.id,
      name,
      type: String(formData.get("type") || "bank"),
      accountNumber: String(formData.get("accountNumber") || "").trim() || null,
      openingBalance: Number(formData.get("openingBalance")) || 0,
    },
  });
  await logAudit({
    buildingId: building.id,
    actorUserId: user.id,
    actorName: user.name,
    actionType: "create",
    moduleTag: "ฐานข้อมูลบัญชี",
    entityType: "Account",
    entityId: account.id,
    entityLabel: account.name,
    description: `เพิ่มบัญชี ${account.name}`,
  });
  revalidatePath("/accounting");
}

// แก้ไขข้อมูลบัญชี (รวมยอดยกมา) — ไม่ log audit เพราะเป็นการแก้ field ทั่วไป ไม่ใช่ action หลักตามสเปค module_audit
export async function updateAccount(formData: FormData) {
  const { building } = await requireAccess("finance");
  const id = Number(formData.get("accountId"));
  const name = String(formData.get("name") || "").trim();
  if (!name) return { error: "กรุณากรอกชื่อบัญชี" };

  const account = await prisma.account.findFirst({ where: { id, buildingId: building.id } });
  if (!account) return { error: "ไม่พบบัญชี" };

  await prisma.account.update({
    where: { id },
    data: {
      name,
      type: String(formData.get("type") || account.type),
      accountNumber: String(formData.get("accountNumber") || "").trim() || null,
      openingBalance: Number(formData.get("openingBalance")) || 0,
    },
  });
  revalidatePath("/accounting");
}

export async function updateAccountStatus(formData: FormData) {
  const { building } = await requireAccess("finance");
  const id = Number(formData.get("accountId"));
  const status = String(formData.get("status") || "active");
  await prisma.account.updateMany({ where: { id, buildingId: building.id }, data: { status } });
  revalidatePath("/accounting");
}

export async function deleteAccount(formData: FormData) {
  const { user, building } = await requireAccess("finance");
  const id = Number(formData.get("accountId"));
  const account = await prisma.account.findFirst({ where: { id, buildingId: building.id } });
  if (!account) return { error: "ไม่พบบัญชี" };

  const balance = await getAccountBalance(id, account.openingBalance);
  if (Math.round(balance * 100) !== 0) {
    return { error: "ลบไม่ได้ — ยอดคงเหลือต้องเป็น 0 ก่อน (ปิดใช้งานแทนได้)" };
  }

  await prisma.account.delete({ where: { id } });
  await logAudit({
    buildingId: building.id,
    actorUserId: user.id,
    actorName: user.name,
    actionType: "delete",
    moduleTag: "ฐานข้อมูลบัญชี",
    entityType: "Account",
    entityId: id,
    entityLabel: account.name,
    description: `ลบบัญชี ${account.name}`,
  });
  revalidatePath("/accounting");
}

// ---------- เงินมัดจำ ----------

export async function returnDepositAction(formData: FormData) {
  const { user } = await requireAccess("finance");
  const depositId = Number(formData.get("depositId"));
  const accountId = Number(formData.get("accountId"));
  if (!accountId) return { error: "กรุณาเลือกบัญชีที่จ่ายเงินออก" };

  try {
    await returnDeposit(depositId, accountId, { id: user.id, name: user.name });
  } catch (e: any) {
    return { error: e.message || "คืนเงินมัดจำไม่สำเร็จ" };
  }
  revalidatePath("/accounting");
}

export async function forfeitDepositAction(formData: FormData) {
  const { building } = await requireAccess("finance");
  const depositId = Number(formData.get("depositId"));

  try {
    await forfeitDeposit(depositId, building.id);
  } catch (e: any) {
    return { error: e.message || "ริบเงินมัดจำไม่สำเร็จ" };
  }
  revalidatePath("/accounting");
  revalidatePath("/other-income");
}

// ---------- บิลรายวัน ----------

export async function issueDailyBill(formData: FormData) {
  const { building } = await requireAccess("finance");

  const roomId = Number(formData.get("roomId"));
  const room = await prisma.room.findFirst({ where: { id: roomId, buildingId: building.id } });
  if (!room) return { error: "ไม่พบห้อง" };
  if (room.dailyPrice == null) return { error: "ห้องนี้ไม่รองรับการเช่ารายวัน" };

  const nights = Number(formData.get("nights"));
  if (!nights || nights <= 0) return { error: "กรุณากรอกจำนวนคืน" };

  const mode = String(formData.get("mode") || "existing");
  let tenantId: number;
  if (mode === "existing") {
    tenantId = Number(formData.get("tenantId"));
    if (!tenantId) return { error: "กรุณาเลือกผู้เช่า" };
  } else {
    const name = String(formData.get("name") || "").trim();
    if (!name) return { error: "กรุณากรอกชื่อผู้เช่า" };
    const tenant = await prisma.tenant.create({
      data: { buildingId: building.id, name, phone: String(formData.get("phone") || "").trim() || null, tenantType: "daily" },
    });
    tenantId = tenant.id;
  }

  const accountId = Number(formData.get("accountId"));
  if (!accountId) return { error: "กรุณาเลือกบัญชีที่รับเงินเข้า" };

  const totalAmount = nights * room.dailyPrice;
  const depositAmount = room.dailyDeposit ?? null;
  const documentNo = await generateMonthlyDocNo("DLY", building.id, (likePrefix) =>
    prisma.dailyBill.count({ where: { buildingId: building.id, documentNo: { startsWith: likePrefix } } })
  );

  const method = String(formData.get("method") || "cash");
  const transferTime = method === "transfer" ? String(formData.get("transferTime") || "").trim() || null : null;

  const dailyBill = await prisma.dailyBill.create({
    data: {
      buildingId: building.id,
      documentNo,
      roomId,
      tenantId,
      checkinDate: new Date(String(formData.get("checkinDate") || new Date())),
      nights,
      dailyPriceSnapshot: room.dailyPrice,
      depositAmountSnapshot: depositAmount,
      totalAmount,
      accountId,
      method,
      transferTime,
    },
  });

  await createLedgerEntry({
    buildingId: building.id,
    accountId,
    direction: "in",
    amount: totalAmount + (depositAmount ?? 0),
    date: new Date(),
    sourceType: "daily_bill",
    sourceId: dailyBill.id,
    description: `บิลรายวัน ${documentNo} ห้อง ${room.roomNumber}`,
  });

  revalidatePath("/accounting");
  revalidatePath("/rooms");
}
