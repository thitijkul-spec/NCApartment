// จุดเดียวสำหรับใส่ comma คั่นหลักพันให้ตัวเลข/จำนวนเงิน — ห้ามใช้กับ identifier (เลขห้อง, เบอร์โทร, เลขบัตร, ปี, รหัสเอกสาร)
export function formatNumber(n: number | null | undefined, fallback = "-"): string {
  if (n === null || n === undefined || isNaN(n)) return fallback;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function formatMoney(n: number | null | undefined, fallback = "-"): string {
  return formatNumber(n, fallback);
}
