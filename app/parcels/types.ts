import type { Parcel, Tenant, Room } from "@prisma/client";

export type ParcelWithRelations = Parcel & { tenant: Tenant | null; room: Room | null };

export const DELIVERY_COMPANIES = ["Kerry", "Flash Express", "J&T Express", "ไปรษณีย์ไทย", "DHL", "Ninja Van", "Lalamove", "SCG Express", "พัสดุด่วน"];

export const STATUS_LABEL: Record<string, string> = { arrived: "พัสดุเข้า", notified: "แจ้งลูกบ้านแล้ว", picked_up: "รับพัสดุแล้ว" };
export const STATUS_BADGE: Record<string, string> = { arrived: "neutral", notified: "warning", picked_up: "success" };

export function isOverdue(p: Parcel, overdueDays: number) {
  if (p.status === "picked_up") return false;
  const days = (Date.now() - new Date(p.receivedAt).getTime()) / (1000 * 60 * 60 * 24);
  return days > overdueDays;
}
