import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import MetersClient from "./MetersClient";

export default async function MetersPage() {
  const { building } = await requireAccess("room");

  const [rooms, readings] = await Promise.all([
    prisma.room.findMany({
      where: { buildingId: building.id },
      include: { occupancies: { where: { status: "active" }, include: { tenant: true } } },
      orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
    }),
    prisma.meterReading.findMany({
      where: { buildingId: building.id },
      orderBy: { recordedAt: "desc" },
    }),
  ]);

  return <MetersClient rooms={rooms} readings={readings} buildingName={building.name} />;
}
