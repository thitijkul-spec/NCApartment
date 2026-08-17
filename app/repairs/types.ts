import type { RepairRequest, Room, Tenant, Technician, RepairCategory, SharedEquipment } from "@prisma/client";

export type RepairRequestWithRelations = RepairRequest & {
  room: Room;
  tenant: Tenant | null;
  assignedTechnician: Technician | null;
};

export type { Room, Technician, RepairCategory, SharedEquipment };
