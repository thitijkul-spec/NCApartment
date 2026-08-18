import type { Expense, ExpenseLineItem, ExpensePayment, Contact } from "@prisma/client";

export type ExpenseWithRelations = Expense & {
  vendorContact: Contact | null;
  lineItems: ExpenseLineItem[];
  payments: ExpensePayment[];
};

export const EXPENSE_CATEGORIES = ["ค่าน้ำ", "ค่าไฟ", "ซ่อมแซม", "ค่าอินเตอร์เน็ต", "เงินเดือน", "วัสดุสิ้นเปลือง", "อื่นๆ"] as const;

export function expensePaymentStatus(e: { totalAmount: number; payments: { amount: number }[] }) {
  const paid = e.payments.reduce((s, p) => s + p.amount, 0);
  if (paid <= 0) return "unpaid";
  if (paid < e.totalAmount) return "partial";
  return "paid";
}
