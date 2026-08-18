export type VatMode = "none" | "included" | "excluded";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** คำนวณ VAT ต่อรายการย่อย — ใช้ร่วมกันทั้ง Expense/OtherIncome line item */
export function calcVat(amount: number, vatMode: VatMode, vatRate: number) {
  if (vatMode === "none") return { vatAmount: 0, totalWithVat: round2(amount) };
  if (vatMode === "included") {
    const vatAmount = round2(amount - amount / (1 + vatRate / 100));
    return { vatAmount, totalWithVat: round2(amount) };
  }
  // excluded
  const vatAmount = round2(amount * (vatRate / 100));
  return { vatAmount, totalWithVat: round2(amount + vatAmount) };
}
