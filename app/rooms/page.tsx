import { prisma } from "@/lib/prisma";
import { requireAccess, hasModuleAccess } from "@/lib/auth";
import RoomsClient from "./RoomsClient";

export default async function RoomsPage() {
  const { user, building } = await requireAccess("room");
  const canPay = hasModuleAccess(user, "finance");

  const [rooms, settings, tenants, accounts] = await Promise.all([
    prisma.room.findMany({
      where: { buildingId: building.id },
      include: {
        occupancies: { include: { tenant: true }, orderBy: { checkinDate: "desc" } },
        bookings: { include: { tenant: true }, orderBy: { createdAt: "desc" } },
        contracts: { where: { archivedAt: null }, include: { tenant: true }, orderBy: { createdAt: "desc" } },
        meterReadings: { orderBy: { readingMonth: "desc" } },
        repairRequests: { include: { assignedTechnician: true }, orderBy: { createdAt: "desc" } },
        bills: { include: { lineItems: true, payments: true }, orderBy: { issueDate: "desc" } },
        dailyBills: { orderBy: { checkinDate: "desc" } },
      },
      orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
    }),
    prisma.buildingSettings.findUnique({ where: { buildingId: building.id } }),
    prisma.tenant.findMany({
      where: { buildingId: building.id, archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true, tenantType: true },
    }),
    prisma.account.findMany({
      where: { buildingId: building.id, status: "active" },
      orderBy: { name: "asc" },
    }),
  ]);

  return <RoomsClient rooms={rooms} settings={settings} tenants={tenants} accounts={accounts} buildingName={building.name} canPay={canPay} />;
}
