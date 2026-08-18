export type UtilityMeteredConfig = {
  excluded: boolean;
  useBuildingDefault: boolean;
  mode: "flat" | "metered";
  rate?: number; // ค่าเหมาจ่าย หรือ บาท/หน่วย แล้วแต่ mode
};

export type UtilityFlatConfig = {
  excluded: boolean;
  useBuildingDefault: boolean;
  amount?: number;
};

export type ExtraFee = { name: string; amount: number; qty?: number };

export function parseUtility<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function serializeUtility(value: unknown): string {
  return JSON.stringify(value);
}

export const DEFAULT_METERED_UTILITY: UtilityMeteredConfig = {
  excluded: false,
  useBuildingDefault: true,
  mode: "flat",
};

export const DEFAULT_FLAT_UTILITY: UtilityFlatConfig = {
  excluded: false,
  useBuildingDefault: true,
};

export const AMENITY_PRESETS = [
  "เตียง",
  "ที่นอน",
  "ตู้เสื้อผ้า",
  "โต๊ะทำงาน",
  "โต๊ะเครื่องแป้ง",
  "เก้าอี้",
  "ชั้นวางของ",
  "แอร์",
  "เครื่องทำน้ำอุ่น",
  "ทีวี",
  "ตู้เย็น",
  "ไมโครเวฟ",
  "ระเบียง",
  "เครื่องซักผ้า",
  "ผ้าม่าน",
  "Wi-Fi",
];

export const ROOM_STATUS_LABEL: Record<string, string> = {
  available: "ว่าง",
  occupied: "มีผู้เช่า",
  reserved: "จองแล้ว",
  maintenance: "ปิดปรับปรุง",
};

export const ROOM_STATUS_BADGE_CLASS: Record<string, string> = {
  available: "success",
  occupied: "occupied",
  reserved: "warning",
  maintenance: "danger",
};

/** ห้องรายเดือนที่มีบิลค้างชำระเลยกำหนดวันครบกำหนด (unpaid/partially_paid + dueDate ผ่านมาแล้ว) */
export function roomHasOverdueBill(bills: { status: string; dueDate: Date | string }[]) {
  const now = new Date();
  return bills.some((b) => (b.status === "unpaid" || b.status === "partially_paid") && new Date(b.dueDate) < now);
}

export type RoomBillingColor = "available" | "monthly" | "daily" | "overdue" | "pending" | "maintenance" | "neutral";

/**
 * สีการ์ดห้องตามลำดับความสำคัญ: ปิดปรับปรุง > ค้างชำระ/รายวันยังไม่จ่าย > รอชำระ (ยังไม่เลยกำหนด) > รายวัน (จ่ายแล้ว) > รายเดือน (ไม่มีปัญหา) > ว่าง
 * รายวัน "ยังไม่จ่าย" = เช็คอินแล้วแต่ยังไม่มี DailyBill ผูกกับผู้เช่าปัจจุบัน (ปกติ DailyBill สร้างพร้อมจ่ายเต็มจำนวนตอน check-in)
 */
export function roomBillingColor(room: {
  status: string;
  occupancies: { status: string; tenant: { id: number; tenantType: string } }[];
  bills: { status: string; dueDate: Date | string }[];
  dailyBills: { tenantId: number }[];
}): RoomBillingColor {
  if (room.status === "maintenance") return "maintenance";

  const occ = room.occupancies.find((o) => o.status === "active");
  if (!occ) return room.status === "available" ? "available" : "neutral";

  if (occ.tenant.tenantType === "daily") {
    const hasDailyBill = room.dailyBills.some((db) => db.tenantId === occ.tenant.id);
    return hasDailyBill ? "daily" : "overdue";
  }

  const now = new Date();
  const activeBills = room.bills.filter((b) => b.status !== "cancelled");
  if (activeBills.some((b) => (b.status === "unpaid" || b.status === "partially_paid") && new Date(b.dueDate) < now)) return "overdue";
  if (activeBills.some((b) => b.status === "unpaid" || b.status === "partially_paid")) return "pending";
  return "monthly";
}

export function rentalTypeLabel(v: string) {
  if (v === "daily") return "รายวัน";
  if (v === "monthly") return "รายเดือน";
  return "รายวัน+รายเดือน";
}
