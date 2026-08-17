import type { Tenant, TenantVehicle, RoomOccupancy, Room, Contract } from "@prisma/client";

export type TenantWithRelations = Tenant & {
  vehicles: TenantVehicle[];
  occupancies: (RoomOccupancy & { room: Room })[];
  contracts: Contract[];
};
