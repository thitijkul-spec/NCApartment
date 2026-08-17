import { prisma } from "./prisma";

async function nextSequence(prefix: string, buildingId: number, countFn: () => Promise<number>) {
  const count = await countFn();
  const seq = String(count + 1).padStart(4, "0");
  return `${prefix}-${buildingId}-${seq}`;
}

export async function generateBillNo(buildingId: number) {
  return nextSequence("BILL", buildingId, () => prisma.bill.count({ where: { buildingId } }));
}

export async function generateReceiptNo(buildingId: number) {
  const count = await prisma.payment.count({ where: { bill: { buildingId } } });
  return `RCP-${buildingId}-${String(count + 1).padStart(4, "0")}`;
}

export async function generateTaxInvoiceNo(buildingId: number) {
  const count = await prisma.payment.count({ where: { bill: { buildingId }, taxInvoiceNo: { not: null } } });
  return `TAX-${buildingId}-${String(count + 1).padStart(4, "0")}`;
}
