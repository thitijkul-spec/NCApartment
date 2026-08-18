import type {
  Room,
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
  DailyBill,
} from "@prisma/client";

export type RoomWithRelations = Room & {
  occupancies: (RoomOccupancy & { tenant: Tenant })[];
  bookings: (Booking & { tenant: Tenant | null })[];
  contracts: (Contract & { tenant: Tenant })[];
  meterReadings: MeterReading[];
  repairRequests: (RepairRequest & { assignedTechnician: Technician | null })[];
  bills: (Bill & { lineItems: BillLineItem[]; payments: Payment[] })[];
  dailyBills: DailyBill[];
};

export type TenantOption = { id: number; name: string; phone: string | null; tenantType: string };

export type { BuildingSettings };
