import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import ParcelsClient from "./ParcelsClient";

export default async function ParcelsPage() {
  const { building } = await requireAccess("maintenance");

  const [parcels, tenants, settings] = await Promise.all([
    prisma.parcel.findMany({
      where: { buildingId: building.id },
      include: { tenant: true, room: true },
      orderBy: { receivedAt: "desc" },
    }),
    prisma.tenant.findMany({ where: { buildingId: building.id, archivedAt: null }, orderBy: { name: "asc" } }),
    prisma.buildingSettings.findUnique({ where: { buildingId: building.id } }),
  ]);

  return (
    <ParcelsClient
      parcels={parcels}
      tenants={tenants}
      overdueDays={settings?.parcelOverdueDays ?? 3}
      buildingName={building.name}
    />
  );
}
