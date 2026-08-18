import { prisma } from "./prisma";
import { generateMonthlyDocNo } from "./doc-numbering";
import { createLedgerEntry } from "./ledger";
import { logAudit } from "./audit";

/** คืนเงินมัดจำเต็มจำนวน — สร้าง ledger entry ขาออกทันที + เปลี่ยนสถานะ returned */
export async function returnDeposit(depositId: number, accountId: number, actor: { id: number; name: string }) {
  const deposit = await prisma.deposit.findUnique({ where: { id: depositId }, include: { room: true } });
  if (!deposit || deposit.status !== "held") throw new Error("มัดจำนี้ไม่ได้อยู่ในสถานะถืออยู่");
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) throw new Error("ไม่พบบัญชี");

  const updated = await prisma.deposit.update({
    where: { id: depositId },
    data: { status: "returned", returnedDate: new Date(), returnedAccountId: accountId },
  });

  await createLedgerEntry({
    buildingId: account.buildingId,
    accountId,
    direction: "out",
    amount: deposit.amount,
    date: new Date(),
    sourceType: "deposit_refund",
    sourceId: depositId,
    description: `คืนเงินมัดจำ ห้อง ${deposit.roomId}`,
  });

  await logAudit({
    buildingId: account.buildingId,
    actorUserId: actor.id,
    actorName: actor.name,
    actionType: "payment",
    moduleTag: "มัดจำ",
    entityType: "Deposit",
    entityId: depositId,
    entityLabel: `ห้อง ${deposit.room.roomNumber}`,
    description: `คืนเงินมัดจำห้อง ${deposit.room.roomNumber} ฿${deposit.amount.toLocaleString()}`,
  });

  return updated;
}

/** ริบเงินมัดจำทั้งหมด — สร้าง OtherIncome หมวด "เงินมัดจำริบ" อัตโนมัติ + เปลี่ยนสถานะ forfeited (ไม่มี ledger entry ใหม่ เพราะเงินไม่ได้เคลื่อนบัญชีจริง แค่เปลี่ยนสถานะทางบัญชี) */
export async function forfeitDeposit(depositId: number, buildingId: number) {
  const deposit = await prisma.deposit.findUnique({
    where: { id: depositId },
    include: {
      contract: { include: { tenant: true } },
      room: { include: { occupancies: { where: { status: "active" }, include: { tenant: true } } } },
    },
  });
  if (!deposit || deposit.status !== "held") throw new Error("มัดจำนี้ไม่ได้อยู่ในสถานะถืออยู่");

  const tenant = deposit.contract?.tenant ?? deposit.room.occupancies[0]?.tenant ?? null;

  const documentNo = await generateMonthlyDocNo("INC", buildingId, (likePrefix) =>
    prisma.otherIncome.count({ where: { buildingId, documentNo: { startsWith: likePrefix } } })
  );

  const otherIncome = await prisma.otherIncome.create({
    data: {
      buildingId,
      documentNo,
      buyerType: "tenant",
      buyerTenantId: tenant?.id ?? null,
      buyerNameSnapshot: tenant?.name ?? "ผู้เช่า (ไม่ทราบชื่อ)",
      buyerTaxIdSnapshot: tenant?.idCardNo ?? null,
      roomId: deposit.roomId,
      date: new Date(),
      saleType: "cash",
      totalAmount: deposit.amount,
      notes: `ริบเงินมัดจำห้อง ${deposit.roomId} จากมัดจำเลขที่ #${deposit.id}`,
      lineItems: {
        create: [
          {
            title: "เงินมัดจำริบ",
            category: "เงินมัดจำริบ",
            amount: deposit.amount,
            vatMode: "none",
            vatRate: 7,
            vatAmount: 0,
            totalWithVat: deposit.amount,
          },
        ],
      },
    },
  });

  const updated = await prisma.deposit.update({
    where: { id: depositId },
    data: { status: "forfeited", forfeitedDate: new Date(), forfeitedOtherIncomeId: otherIncome.id },
  });

  await logAudit({
    buildingId,
    actorUserId: null,
    actorName: "ระบบ (ริบเงินมัดจำ)",
    actionType: "status_change",
    moduleTag: "มัดจำ",
    entityType: "Deposit",
    entityId: depositId,
    entityLabel: `ห้อง ${deposit.roomId}`,
    description: `ริบเงินมัดจำห้อง ${deposit.roomId} ฿${deposit.amount.toLocaleString()} — สร้างรายได้อื่นๆ ${otherIncome.documentNo} อัตโนมัติ`,
  });

  return { deposit: updated, otherIncome };
}
