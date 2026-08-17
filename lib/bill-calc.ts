import { parseUtility, DEFAULT_METERED_UTILITY, DEFAULT_FLAT_UTILITY } from "./room-utils";
import type { UtilityMeteredConfig, UtilityFlatConfig, ExtraFee } from "./room-utils";
import type { Room, BuildingSettings, MeterReading, Contract } from "@prisma/client";

export type DraftLineItem = {
  itemType: string;
  description: string;
  quantity: number | null;
  unitPrice: number | null;
  amount: number;
};

/** สร้างรายการค่าใช้จ่ายของบิลรายเดือน 1 ห้อง จากสัญญา+ค่าตั้งห้อง/อาคาร+มิเตอร์ล่าสุดที่ยังไม่ออกบิล */
export function buildMonthlyLineItems(
  room: Room,
  settings: BuildingSettings | null,
  meterReading: MeterReading | null,
  contract: Contract
): { lineItems: DraftLineItem[]; warnings: string[]; meterReadingConsumed: boolean } {
  const lineItems: DraftLineItem[] = [];
  const warnings: string[] = [];
  let meterReadingConsumed = false;

  lineItems.push({ itemType: "rent", description: "ค่าเช่า", quantity: null, unitPrice: null, amount: contract.rentAmount });

  const water = parseUtility<UtilityMeteredConfig>(room.utilityWater, DEFAULT_METERED_UTILITY);
  if (!water.excluded) {
    const mode = water.useBuildingDefault ? settings?.defaultWaterMode ?? "flat" : water.mode;
    const rate = water.useBuildingDefault ? settings?.defaultWaterRate : water.rate;
    if (mode === "metered") {
      if (meterReading) {
        lineItems.push({
          itemType: "water",
          description: `ค่าน้ำ (${meterReading.waterUnits} หน่วย)`,
          quantity: meterReading.waterUnits,
          unitPrice: rate ?? 0,
          amount: meterReading.waterUnits * (rate ?? 0),
        });
        meterReadingConsumed = true;
      } else {
        warnings.push("ไม่มีข้อมูลมิเตอร์น้ำที่ยังไม่ออกบิล — ข้ามรายการค่าน้ำ");
      }
    } else if (rate) {
      lineItems.push({ itemType: "water", description: "ค่าน้ำ (เหมาจ่าย)", quantity: null, unitPrice: null, amount: rate });
    }
  }

  const electric = parseUtility<UtilityMeteredConfig>(room.utilityElectric, DEFAULT_METERED_UTILITY);
  if (!electric.excluded) {
    const mode = electric.useBuildingDefault ? settings?.defaultElectricMode ?? "flat" : electric.mode;
    const rate = electric.useBuildingDefault ? settings?.defaultElectricRate : electric.rate;
    if (mode === "metered") {
      if (meterReading) {
        lineItems.push({
          itemType: "electric",
          description: `ค่าไฟ (${meterReading.electricUnits} หน่วย)`,
          quantity: meterReading.electricUnits,
          unitPrice: rate ?? 0,
          amount: meterReading.electricUnits * (rate ?? 0),
        });
        meterReadingConsumed = true;
      } else {
        warnings.push("ไม่มีข้อมูลมิเตอร์ไฟที่ยังไม่ออกบิล — ข้ามรายการค่าไฟ");
      }
    } else if (rate) {
      lineItems.push({ itemType: "electric", description: "ค่าไฟ (เหมาจ่าย)", quantity: null, unitPrice: null, amount: rate });
    }
  }

  const internet = parseUtility<UtilityFlatConfig>(room.utilityInternet, DEFAULT_FLAT_UTILITY);
  if (!internet.excluded) {
    const amount = internet.useBuildingDefault ? settings?.defaultInternetFee : internet.amount;
    if (amount) lineItems.push({ itemType: "internet", description: "ค่าอินเทอร์เน็ต", quantity: null, unitPrice: null, amount });
  }

  const commonArea = parseUtility<UtilityFlatConfig>(room.utilityCommonArea, DEFAULT_FLAT_UTILITY);
  if (!commonArea.excluded) {
    const amount = commonArea.useBuildingDefault ? settings?.defaultCommonAreaFee : commonArea.amount;
    if (amount) lineItems.push({ itemType: "common_area", description: "ค่าส่วนกลาง", quantity: null, unitPrice: null, amount });
  }

  const extraFees = parseUtility<ExtraFee[]>(room.extraMonthlyFees, []);
  for (const fee of extraFees) {
    lineItems.push({ itemType: "extra_fee", description: fee.name, quantity: null, unitPrice: null, amount: fee.amount });
  }

  return { lineItems, warnings, meterReadingConsumed };
}

export function buildMoveInLineItems(contract: Contract): DraftLineItem[] {
  const items: DraftLineItem[] = [
    { itemType: "rent", description: "ค่าเช่าเดือนแรก", quantity: null, unitPrice: null, amount: contract.rentAmount },
  ];
  if (contract.depositAmount) {
    items.push({ itemType: "deposit", description: "เงินประกันการเช่า", quantity: null, unitPrice: null, amount: contract.depositAmount });
  }
  if (contract.advanceRentAmount) {
    items.push({ itemType: "advance_rent", description: "เงินล่วงหน้า", quantity: null, unitPrice: null, amount: contract.advanceRentAmount });
  }
  if (contract.electricalEquipmentFee) {
    items.push({
      itemType: "equipment_electrical",
      description: "ค่าอุปกรณ์ไฟฟ้า",
      quantity: null,
      unitPrice: null,
      amount: contract.electricalEquipmentFee,
    });
  }
  if (contract.furnitureEquipmentFee) {
    items.push({
      itemType: "equipment_furniture",
      description: "ค่าครุภัณฑ์/เฟอร์นิเจอร์",
      quantity: null,
      unitPrice: null,
      amount: contract.furnitureEquipmentFee,
    });
  }
  return items;
}

export function billTotal(lineItems: { amount: number }[], discountAmount: number | null | undefined) {
  return lineItems.reduce((s, li) => s + li.amount, 0) - (discountAmount ?? 0);
}
