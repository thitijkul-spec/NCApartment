import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import TenantsClient from "./TenantsClient";

export default async function TenantsPage() {
  const { building } = await requireAccess("tenant");

  const tenants = await prisma.tenant.findMany({
    where: { buildingId: building.id },
    include: {
      vehicles: true,
      occupancies: { include: { room: true }, orderBy: { checkinDate: "desc" } },
      contracts: { where: { archivedAt: null } },
    },
    orderBy: { createdAt: "desc" },
  });

  return <TenantsClient tenants={tenants} buildingName={building.name} />;
}
