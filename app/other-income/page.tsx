import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import OtherIncomeClient from "./OtherIncomeClient";

export default async function OtherIncomePage() {
  const { building } = await requireAccess("finance");

  const [items, contacts, tenants, accounts] = await Promise.all([
    prisma.otherIncome.findMany({
      where: { buildingId: building.id },
      include: { buyerContact: true, buyerTenant: true, lineItems: true, payments: true },
      orderBy: { date: "desc" },
    }),
    prisma.contact.findMany({ orderBy: { name: "asc" } }),
    prisma.tenant.findMany({ where: { buildingId: building.id, archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.account.findMany({ where: { buildingId: building.id, status: "active" }, orderBy: { name: "asc" } }),
  ]);

  return <OtherIncomeClient items={items} contacts={contacts} tenants={tenants} accounts={accounts} buildingName={building.name} />;
}
