import { prisma } from "./prisma";

/** เลขเอกสารรีเซ็ตรายเดือน เช่น EXP-2569-08-0001 — นับเฉพาะ record ของอาคารนี้ที่ documentNo ขึ้นต้นด้วย prefix+เดือนปัจจุบัน (พ.ศ.) */
export async function generateMonthlyDocNo(
  prefix: "EXP" | "INC" | "DLY",
  buildingId: number,
  countFn: (likePrefix: string) => Promise<number>
) {
  const now = new Date();
  const yearBE = now.getFullYear() + 543;
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const likePrefix = `${prefix}-${yearBE}-${month}-`;
  const count = await countFn(likePrefix);
  return `${likePrefix}${String(count + 1).padStart(4, "0")}`;
}
