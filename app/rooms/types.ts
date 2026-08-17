import type {
  Room,
  RoomImage,
  RoomOccupancy,
  Tenant,
  Booking,
  Contract,
  BuildingSettings,
  MeterReading,
  RepairRequest,
  Technician,
  Bill,
  BillLineItem,
  Payment,
} from "@prisma/client";

export type RoomWithRelations = Room & {
  images: RoomImage[];
  occupancies: (RoomOccupancy & { tenant: Tenant })[];
  bookings: (Booking & { tenant: Tenant | null })[];
  contracts: (Contract & { tenant: Tenant })[];
  meterReadings: MeterReading[];
  repairRequests: (RepairRequest & { assignedTechnician: Technician | null })[];
  bills: (Bill & { lineItems: BillLineItem[]; payments: Payment[] })[];
};

export type TenantOption = { id: number; name: string; phone: string | null; tenantType: string };

export type { BuildingSettings };
