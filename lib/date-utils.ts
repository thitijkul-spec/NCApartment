export function formatDateBE(d: Date | string | null | undefined, fallback = "-"): string {
  if (!d) return fallback;
  const date = new Date(d);
  if (isNaN(date.getTime())) return fallback;
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear() + 543;
  return `${day}-${month}-${year}`;
}

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

/** "YYYY-MM" -> "สิงหาคม 2569" */
export function formatMonthKeyTH(monthKey: string, fallback = "-"): string {
  const [y, m] = monthKey.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return fallback;
  return `${THAI_MONTHS[m - 1]} ${y + 543}`;
}

export function formatDateTimeBE(d: Date | string | null | undefined, fallback = "-"): string {
  if (!d) return fallback;
  const date = new Date(d);
  if (isNaN(date.getTime())) return fallback;
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${formatDateBE(date, fallback)} ${hours}:${minutes}`;
}
