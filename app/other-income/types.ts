import type { OtherIncome, OtherIncomeLineItem, OtherIncomePayment, Contact, Tenant } from "@prisma/client";

export type OtherIncomeWithRelations = OtherIncome & {
  buyerContact: Contact | null;
  buyerTenant: Tenant | null;
  lineItems: OtherIncomeLineItem[];
  payments: OtherIncomePayment[];
};

export const OTHER_INCOME_CATEGORIES = [
  "ค่าปรับ/ค่าเสียหาย",
  "ค่าเช่าพื้นที่ส่วนกลาง/ป้ายโฆษณา",
  "ดอกเบี้ยรับ",
  "เงินมัดจำริบ",
  "ขายของเก่า/เศษวัสดุ",
  "ค่าจอดรถ",
  "เครื่องซักผ้า/ตู้หยอดเหรียญ",
  "ค่าธรรมเนียมเอกสาร",
  "เงินสนับสนุนส่วนกลาง",
  "อื่นๆ",
] as const;

export function otherIncomePaymentStatus(o: { totalAmount: number; payments: { amount: number }[] }) {
  const paid = o.payments.reduce((s, p) => s + p.amount, 0);
  if (paid <= 0) return "unpaid";
  if (paid < o.totalAmount) return "partial";
  return "paid";
}
