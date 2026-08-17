import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import BillsClient from "./BillsClient";

export default async function BillsPage() {
  const { building } = await requireAccess("finance");

  const [bills, rooms, contractsWithoutBill] = await Promise.all([
    prisma.bill.findMany({
      where: { buildingId: building.id },
      include: { room: true, tenant: true, lineItems: true, payments: true },
      orderBy: { issueDate: "desc" },
    }),
    prisma.room.findMany({
      where: { buildingId: building.id },
      include: { occupancies: { where: { status: "active" }, include: { tenant: true } } },
      orderBy: [{ floor: "asc" }, { roomNumber: "asc" }],
    }),
    prisma.contract.findMany({
      where: { buildingId: building.id, archivedAt: null, bills: { none: { billType: "move_in" } } },
      include: { tenant: true, room: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return <BillsClient bills={bills} rooms={rooms} moveInCandidates={contractsWithoutBill} buildingName={building.name} />;
}
