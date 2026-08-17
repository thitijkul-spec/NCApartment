import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import ContractFormClient from "../ContractFormClient";
import { CalendarIcon } from "../../icons";

export default async function NewContractPage({ searchParams }: { searchParams: { occupancyId?: string } }) {
  const { building } = await requireAccess("tenant");

  const occupancyId = Number(searchParams.occupancyId);
  if (!occupancyId) {
    return (
      <div className="card">
        กรุณาสร้างสัญญาจากหน้าห้อง (Tab ผู้เช่า) เพื่อระบุผู้เช่า/ห้องที่จะทำสัญญาก่อน — <a href="/rooms">ไปหน้าห้องพัก</a>
      </div>
    );
  }

  const occupancy = await prisma.roomOccupancy.findFirst({
    where: { id: occupancyId, room: { buildingId: building.id } },
    include: { room: true, tenant: true },
  });
  if (!occupancy) {
    return <div className="card">ไม่พบข้อมูลการเข้าพักนี้</div>;
  }

  const [clauseTemplates, otherActiveContract] = await Promise.all([
    prisma.contractClauseTemplate.findMany({ where: { buildingId: building.id }, orderBy: { order: "asc" } }),
    prisma.contract.findFirst({
      where: {
        roomId: occupancy.roomId,
        tenantId: { not: occupancy.tenantId },
        archivedAt: null,
        signedAt: { not: null },
        OR: [{ noEndDate: true }, { endDate: { gte: new Date() } }],
      },
      include: { tenant: true },
    }),
  ]);

  return (
    <div>
      <h1 className="page-title">
        <CalendarIcon size={22} /> สร้างสัญญาใหม่
      </h1>
      {otherActiveContract && (
        <div className="form-error" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>
          ห้อง {occupancy.room.roomNumber} มีสัญญาที่เซ็นแล้วและยังไม่หมดอายุของผู้เช่า {otherActiveContract.tenant.name} อยู่ก่อน —
          ยืนยันสร้างสัญญาซ้อนต่อได้ตามดุลยพินิจ
        </div>
      )}
      <ContractFormClient
        mode="new"
        contract={null}
        room={occupancy.room}
        tenant={occupancy.tenant}
        occupancy={occupancy}
        clauseTemplates={clauseTemplates}
      />
    </div>
  );
}
