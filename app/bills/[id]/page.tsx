import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { notFound } from "next/navigation";
import BillDetailClient from "./BillDetailClient";

export default async function BillDetailPage({ params }: { params: { id: string } }) {
  const { building } = await requireAccess("finance");
  const id = Number(params.id);

  const [bill, accounts] = await Promise.all([
    prisma.bill.findFirst({
      where: { id, buildingId: building.id },
      include: { room: true, tenant: true, contract: true, lineItems: true, payments: { include: { account: true } } },
    }),
    prisma.account.findMany({ where: { buildingId: building.id, status: "active" }, orderBy: { name: "asc" } }),
  ]);
  if (!bill) notFound();

  return <BillDetailClient bill={bill} accounts={accounts} buildingName={building.name} />;
}
