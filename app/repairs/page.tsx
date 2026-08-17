import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import RepairsClient from "./RepairsClient";

export default async function RepairsPage() {
  const { building } = await requireAccess("maintenance");

  const [requests, categories, technicians, equipment, rooms] = await Promise.all([
    prisma.repairRequest.findMany({
      where: { buildingId: building.id },
      include: { room: true, tenant: true, assignedTechnician: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.repairCategory.findMany({ where: { buildingId: building.id }, orderBy: { id: "asc" } }),
    prisma.technician.findMany({ where: { buildingId: building.id }, orderBy: { id: "asc" } }),
    prisma.sharedEquipment.findMany({ where: { buildingId: building.id }, orderBy: { id: "asc" } }),
    prisma.room.findMany({ where: { buildingId: building.id }, orderBy: [{ floor: "asc" }, { roomNumber: "asc" }] }),
  ]);

  return (
    <RepairsClient
      requests={requests}
      categories={categories}
      technicians={technicians}
      equipment={equipment}
      rooms={rooms}
      buildingName={building.name}
    />
  );
}
