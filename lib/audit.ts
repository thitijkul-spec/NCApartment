import { prisma } from "./prisma";

export type AuditActionType = "create" | "delete" | "payment" | "status_change";

/** log เฉพาะ action สำคัญ (สร้าง/ลบ/เงิน/เปลี่ยนสถานะ) ของ entity หลักแต่ละ module — ไม่ log การแก้ไข field ทั่วไป */
export async function logAudit(params: {
  buildingId: number;
  actorUserId: number | null; // null = system actor
  actorName: string;
  actionType: AuditActionType;
  moduleTag: string;
  entityType: string;
  entityId: string | number;
  entityLabel: string;
  description: string;
}) {
  await prisma.auditLog.create({
    data: {
      buildingId: params.buildingId,
      actorType: params.actorUserId ? "user" : "system",
      actorUserId: params.actorUserId,
      actorNameSnapshot: params.actorName,
      actionType: params.actionType,
      moduleTag: params.moduleTag,
      entityType: params.entityType,
      entityId: String(params.entityId),
      entityLabel: params.entityLabel,
      description: params.description,
    },
  });
}
