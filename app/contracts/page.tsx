import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import ContractsClient from "./ContractsClient";

export default async function ContractsPage() {
  const { building } = await requireAccess("tenant");

  const contracts = await prisma.contract.findMany({
    where: { buildingId: building.id, archivedAt: null },
    include: { tenant: true, room: true },
    orderBy: { createdAt: "desc" },
  });

  return <ContractsClient contracts={contracts} buildingName={building.name} />;
}
