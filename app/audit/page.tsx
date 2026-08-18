import { prisma } from "@/lib/prisma";
import { requireUser, getCurrentBuilding } from "@/lib/auth";
import { redirect } from "next/navigation";
import AuditClient from "./AuditClient";

export default async function AuditPage() {
  const user = await requireUser();
  if (user.role !== "owner") redirect("/");

  const building = await getCurrentBuilding(user);
  if (!building) redirect("/select-building");

  const logs = await prisma.auditLog.findMany({
    where: { buildingId: building.id },
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  return <AuditClient logs={logs} buildingName={building.name} />;
}
