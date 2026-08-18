import { prisma } from "./prisma";

export type LedgerSourceType = "bill_payment" | "expense_payment" | "other_income_payment" | "deposit_refund" | "deposit_forfeit" | "daily_bill";

export async function createLedgerEntry(params: {
  buildingId: number;
  accountId: number;
  direction: "in" | "out";
  amount: number;
  date: Date;
  sourceType: LedgerSourceType;
  sourceId: number;
  description?: string;
}) {
  return prisma.ledgerEntry.create({
    data: {
      buildingId: params.buildingId,
      accountId: params.accountId,
      direction: params.direction,
      amount: params.amount,
      date: params.date,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      description: params.description ?? null,
    },
  });
}

/** ยอดคงเหลือปัจจุบันของบัญชี = opening_balance + ผลรวม LedgerEntry (in - out) */
export async function getAccountBalance(accountId: number, openingBalance: number) {
  const entries = await prisma.ledgerEntry.findMany({ where: { accountId }, select: { direction: true, amount: true } });
  const net = entries.reduce((sum, e) => sum + (e.direction === "in" ? e.amount : -e.amount), 0);
  return openingBalance + net;
}
