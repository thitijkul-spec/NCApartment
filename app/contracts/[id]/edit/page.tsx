import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import ContractFormClient from "../../ContractFormClient";
import { CalendarIcon } from "../../../icons";
import { notFound } from "next/navigation";

export default async function EditContractPage({ params }: { params: { id: string } }) {
  const { building } = await requireAccess("tenant");
  const id = Number(params.id);

  const [contract, clauseTemplates] = await Promise.all([
    prisma.contract.findFirst({
      where: { id, buildingId: building.id },
      include: { clauseSelections: true, room: true, tenant: true, occupancy: true },
    }),
    prisma.contractClauseTemplate.findMany({ where: { buildingId: building.id }, orderBy: { order: "asc" } }),
  ]);
  if (!contract) notFound();

  return (
    <div>
      <h1 className="page-title">
        <CalendarIcon size={22} /> แก้ไขสัญญา
      </h1>
      <ContractFormClient
        mode="edit"
        contract={contract}
        room={contract.room}
        tenant={contract.tenant}
        occupancy={contract.occupancy}
        clauseTemplates={clauseTemplates}
      />
    </div>
  );
}
