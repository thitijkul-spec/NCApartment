import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import ReceiptsClient from "./ReceiptsClient";

export default async function ReceiptsPage() {
  const { building } = await requireAccess("finance");

  const payments = await prisma.payment.findMany({
    where: { bill: { buildingId: building.id } },
    include: { bill: { include: { room: true, tenant: true } } },
    orderBy: { paidAt: "desc" },
  });

  return <ReceiptsClient payments={payments} buildingName={building.name} />;
}
