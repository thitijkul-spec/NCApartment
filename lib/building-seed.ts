import { prisma } from "./prisma";
import { seedDefaultContractClauses } from "./contract-clauses-seed";

const DEFAULT_REPAIR_CATEGORIES = ["ไฟฟ้า", "ประปา", "แอร์", "เครื่องใช้ไฟฟ้า", "อื่นๆ"];

/** ข้อมูลตั้งต้นที่ทุกอาคารใหม่ต้องมี — เรียกครั้งเดียวตอนสร้างอาคาร (bootstrap owner หรือเพิ่มอาคารใหม่) */
export async function seedNewBuildingDefaults(buildingId: number) {
  await Promise.all([
    seedDefaultContractClauses(buildingId),
    prisma.repairCategory.createMany({
      data: DEFAULT_REPAIR_CATEGORIES.map((name) => ({ buildingId, name, isDefault: true })),
    }),
  ]);
}
