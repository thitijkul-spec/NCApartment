import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import BookingsClient from "./BookingsClient";

export default async function BookingsPage() {
  const { building } = await requireAccess("room");

  const [bookings, rooms, accounts, tenants] = await Promise.all([
    prisma.booking.findMany({
      where: { buildingId: building.id },
      include: { room: true, tenant: true, payments: { include: { account: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.room.findMany({
      where: { buildingId: building.id },
      orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
      select: {
        id: true,
        roomNumber: true,
        floor: true,
        status: true,
        rentalTypeSupport: true,
        monthlyPrice: true,
        dailyPrice: true,
        monthlyDeposit: true,
        dailyDeposit: true,
      },
    }),
    prisma.account.findMany({ where: { buildingId: building.id, status: "active" }, orderBy: { name: "asc" } }),
    prisma.tenant.findMany({
      where: { buildingId: building.id, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true, tenantType: true },
    }),
  ]);

  return <BookingsClient bookings={bookings} rooms={rooms} accounts={accounts} tenants={tenants} buildingName={building.name} />;
}
