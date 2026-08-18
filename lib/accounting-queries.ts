import { prisma } from "./prisma";

/** ยอดค้างรับจากผู้เช่า — ดึงบิล unpaid/partial ทุกใบ group ตามผู้เช่า ใช้ร่วมกันทั้งหน้า Accounting และ Report */
export async function getReceivablesSummary(buildingId: number) {
  const bills = await prisma.bill.findMany({
    where: { buildingId, status: { in: ["unpaid", "partially_paid"] } },
    include: { room: true, tenant: true, lineItems: true, payments: true },
  });

  const byTenant = new Map<number, { tenantName: string; roomNumbers: Set<string>; billCount: number; balance: number }>();
  for (const b of bills) {
    const total = b.lineItems.reduce((s, li) => s + li.amount, 0) - (b.discountAmount ?? 0);
    const paid = b.payments.reduce((s, p) => s + p.amount, 0);
    const balance = total - paid;
    if (balance <= 0) continue;
    const entry = byTenant.get(b.tenantId) ?? { tenantName: b.tenant.name, roomNumbers: new Set(), billCount: 0, balance: 0 };
    entry.roomNumbers.add(b.room.roomNumber);
    entry.billCount += 1;
    entry.balance += balance;
    byTenant.set(b.tenantId, entry);
  }

  return Array.from(byTenant.entries()).map(([tenantId, v]) => ({
    tenantId,
    tenantName: v.tenantName,
    rooms: Array.from(v.roomNumbers).join(", "),
    billCount: v.billCount,
    balance: v.balance,
  }));
}

/** ยอดค้างจ่ายฝั่งซื้อเชื่อ — Expense purchaseType=credit ที่ยังไม่จ่ายครบ group ตามผู้ขาย */
export async function getPayablesSummary(buildingId: number) {
  const expenses = await prisma.expense.findMany({
    where: { buildingId, purchaseType: "credit" },
    include: { vendorContact: true, payments: true },
  });

  const byVendor = new Map<string, { vendorName: string; billCount: number; balance: number }>();
  for (const e of expenses) {
    const paid = e.payments.reduce((s, p) => s + p.amount, 0);
    const balance = e.totalAmount - paid;
    if (balance <= 0) continue;
    const key = e.vendorContactId ? String(e.vendorContactId) : `snapshot:${e.vendorNameSnapshot ?? "ไม่ระบุผู้ขาย"}`;
    const vendorName = e.vendorNameSnapshot ?? e.vendorContact?.name ?? "ไม่ระบุผู้ขาย";
    const entry = byVendor.get(key) ?? { vendorName, billCount: 0, balance: 0 };
    entry.billCount += 1;
    entry.balance += balance;
    byVendor.set(key, entry);
  }

  return Array.from(byVendor.values());
}
