import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { getAccountBalance } from "@/lib/ledger";
import { getReceivablesSummary, getPayablesSummary } from "@/lib/accounting-queries";
import AccountingClient from "./AccountingClient";

export default async function AccountingPage() {
  const { building } = await requireAccess("finance");
  const buildingId = building.id;

  const [
    payments,
    bills,
    otherIncomes,
    contracts,
    deposits,
    expenses,
    dailyBills,
    accounts,
    dailyRooms,
    dailyTenants,
    receivables,
    payables,
  ] = await Promise.all([
    prisma.payment.findMany({ where: { bill: { buildingId } }, include: { bill: { include: { room: true, tenant: true } } }, orderBy: { paidAt: "desc" } }),
    prisma.bill.findMany({ where: { buildingId }, include: { room: true, tenant: true, lineItems: true, payments: true }, orderBy: { issueDate: "desc" } }),
    prisma.otherIncome.findMany({
      where: { buildingId },
      include: { buyerContact: true, buyerTenant: true, lineItems: true, payments: true },
      orderBy: { date: "desc" },
    }),
    prisma.contract.findMany({ where: { buildingId }, include: { room: true, tenant: true }, orderBy: { startDate: "desc" } }),
    prisma.deposit.findMany({
      where: { room: { buildingId } },
      include: { room: true, contract: { include: { tenant: true } } },
      orderBy: { collectedDate: "desc" },
    }),
    prisma.expense.findMany({ where: { buildingId }, include: { vendorContact: true, lineItems: true, payments: true }, orderBy: { date: "desc" } }),
    prisma.dailyBill.findMany({ where: { buildingId }, include: { room: true, tenant: true, account: true }, orderBy: { createdAt: "desc" } }),
    prisma.account.findMany({ where: { buildingId }, orderBy: { name: "asc" } }),
    prisma.room.findMany({ where: { buildingId, dailyPrice: { not: null } }, orderBy: { roomNumber: "asc" } }),
    prisma.tenant.findMany({ where: { buildingId, archivedAt: null, tenantType: "daily" }, orderBy: { name: "asc" } }),
    getReceivablesSummary(buildingId),
    getPayablesSummary(buildingId),
  ]);

  const activeAccounts = accounts.filter((a) => a.status === "active");
  const balances = await Promise.all(accounts.map((a) => getAccountBalance(a.id, a.openingBalance)));

  return (
    <AccountingClient
      buildingName={building.name}
      payments={payments}
      bills={bills}
      otherIncomes={otherIncomes}
      contracts={contracts}
      deposits={deposits}
      expenses={expenses}
      dailyBills={dailyBills}
      accounts={accounts}
      activeAccounts={activeAccounts}
      accountBalances={balances}
      dailyRooms={dailyRooms}
      dailyTenants={dailyTenants}
      receivables={receivables}
      payables={payables}
    />
  );
}
