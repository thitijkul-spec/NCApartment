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

export type ExtraFee = { name: string; amount: number };

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
  occupied: "neutral",
  reserved: "warning",
  maintenance: "danger",
};

export function rentalTypeLabel(v: string) {
  if (v === "daily") return "รายวัน";
  if (v === "monthly") return "รายเดือน";
  return "รายวัน+รายเดือน";
}
