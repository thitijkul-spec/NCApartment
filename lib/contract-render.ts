import { formatMoneyWithText } from "./thai-baht-text";
import { BILINGUAL_GOVERNING_CLAUSE } from "./contract-clauses-seed";
import type { Contract, Room, Tenant, Building, ContractClauseTemplate, ContractClauseSelection } from "@prisma/client";

export type ContractRenderData = Contract & {
  room: Room;
  tenant: Tenant;
  building: Building;
  clauseSelections: (ContractClauseSelection & { clauseTemplate: ContractClauseTemplate })[];
};

function fmtDateTh(d: Date | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "long", day: "numeric" });
}
function fmtDateEn(d: Date | null) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function petsText(allow: boolean, lang: "th" | "en") {
  if (lang === "en") return allow ? "pets are allowed" : "pets are not allowed";
  return allow ? "อนุญาตให้เลี้ยงสัตว์เลี้ยง" : "ไม่อนุญาตให้เลี้ยงสัตว์เลี้ยง";
}
function smokingText(noSmoking: boolean, lang: "th" | "en") {
  if (lang === "en") return noSmoking ? "smoking is prohibited inside the building" : "smoking is permitted in designated areas";
  return noSmoking ? "ห้ามสูบบุหรี่ในอาคาร" : "อนุญาตให้สูบบุหรี่ในพื้นที่ที่กำหนด";
}

function placeholderMap(c: ContractRenderData, lang: "th" | "en"): Record<string, string> {
  const fmtDate = lang === "th" ? fmtDateTh : fmtDateEn;
  const money = (n: number | null | undefined) => (lang === "th" ? formatMoneyWithText(n) : n != null ? n.toLocaleString("en-US") : "-");
  return {
    "หมายเลขห้อง": c.room.roomNumber,
    "ชั้น": String(c.room.floor),
    "ที่อยู่หอพัก": c.building.address ?? "",
    "วันเริ่มสัญญา": fmtDate(c.startDate),
    "วันสิ้นสุดสัญญา": c.noEndDate ? (lang === "th" ? "ไม่มีกำหนด" : "no fixed end date") : fmtDate(c.endDate),
    "วันที่ทำสัญญา": fmtDate(c.contractDate),
    "จำนวนวันแจ้งล่วงหน้า": String(c.noticeDaysBeforeTerminate),
    "ค่าเช่า": money(c.rentAmount),
    "วันกำหนดชำระ": String(c.paymentDueDay),
    "ค่าปรับล่าช้า": money(c.lateFeePerDay),
    "เงินประกัน": money(c.depositAmount),
    "จำนวนวันคืนเงินประกัน": String(c.depositReturnDays),
    "ค่าอุปกรณ์ไฟฟ้า": money(c.electricalEquipmentFee),
    "ค่าครุภัณฑ์เฟอร์นิเจอร์": money(c.furnitureEquipmentFee),
    "อนุญาต/ไม่อนุญาตให้เลี้ยงสัตว์": petsText(c.allowPets, lang),
    "อนุญาต/ห้ามสูบบุหรี่ในอาคาร": smokingText(c.noSmoking, lang),
    "จำนวนวันค้างชำระที่อนุญาต": String(c.allowedOverdueDays),
  };
}

function substitute(template: string, map: Record<string, string>): string {
  return template.replace(/\{([^}]+)\}/g, (match, key) => (key in map ? map[key] : match));
}

export type RenderedClause = { number: number; titleTh: string; bodyTh: string; titleEn?: string; bodyEn?: string };

export function renderContractClauses(c: ContractRenderData): RenderedClause[] {
  const mapTh = placeholderMap(c, "th");
  const mapEn = placeholderMap(c, "en");
  const included = c.clauseSelections
    .filter((s) => s.included)
    .sort((a, b) => a.clauseTemplate.order - b.clauseTemplate.order);

  const clauses: RenderedClause[] = included.map((s, i) => ({
    number: i + 1,
    titleTh: s.clauseTemplate.title,
    bodyTh: substitute(s.clauseTemplate.body, mapTh),
    titleEn: c.isBilingual && s.clauseTemplate.titleEn ? s.clauseTemplate.titleEn : undefined,
    bodyEn: c.isBilingual && s.clauseTemplate.bodyEn ? substitute(s.clauseTemplate.bodyEn, mapEn) : undefined,
  }));

  if (c.isBilingual) {
    clauses.push({
      number: clauses.length + 1,
      titleTh: BILINGUAL_GOVERNING_CLAUSE.title,
      bodyTh: BILINGUAL_GOVERNING_CLAUSE.body,
      titleEn: BILINGUAL_GOVERNING_CLAUSE.titleEn,
      bodyEn: BILINGUAL_GOVERNING_CLAUSE.bodyEn,
    });
  }

  return clauses;
}
