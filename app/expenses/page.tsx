import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import ExpensesClient from "./ExpensesClient";

export default async function ExpensesPage() {
  const { building } = await requireAccess("finance");

  const [expenses, contacts, accounts] = await Promise.all([
    prisma.expense.findMany({
      where: { buildingId: building.id },
      include: { vendorContact: true, lineItems: true, payments: true },
      orderBy: { date: "desc" },
    }),
    prisma.contact.findMany({ orderBy: { name: "asc" } }),
    prisma.account.findMany({ where: { buildingId: building.id, status: "active" }, orderBy: { name: "asc" } }),
  ]);

  return <ExpensesClient expenses={expenses} contacts={contacts} accounts={accounts} buildingName={building.name} />;
}
