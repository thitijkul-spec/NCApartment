const DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"];
const POSITIONS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน", "ล้าน"];

function convertGroup(numStr: string): string {
  let result = "";
  const len = numStr.length;
  for (let i = 0; i < len; i++) {
    const digit = Number(numStr[i]);
    const pos = len - i - 1;
    if (digit === 0) continue;
    if (pos === 0 && digit === 1 && len > 1) {
      result += "เอ็ด";
    } else if (pos === 1 && digit === 2) {
      result += "ยี่" + POSITIONS[1];
    } else if (pos === 1 && digit === 1) {
      result += POSITIONS[1];
    } else {
      result += DIGITS[digit] + POSITIONS[pos];
    }
  }
  return result;
}

function integerToThaiText(n: number): string {
  if (n === 0) return "ศูนย์";
  let result = "";
  let millionsChunks: string[] = [];
  let remaining = Math.floor(n);
  if (remaining === 0) millionsChunks.push("0");
  while (remaining > 0) {
    millionsChunks.unshift(String(remaining % 1000000).padStart(remaining >= 1000000 ? 6 : 0, "0"));
    remaining = Math.floor(remaining / 1000000);
  }
  for (let i = 0; i < millionsChunks.length; i++) {
    result += convertGroup(millionsChunks[i]);
    if (i < millionsChunks.length - 1) result += "ล้าน";
  }
  return result;
}

/** แปลงจำนวนเงินเป็นข้อความไทยแบบใช้ในเอกสารราชการ/สัญญา เช่น 7500 -> "เจ็ดพันห้าร้อยบาทถ้วน" */
export function bahtText(amount: number): string {
  const rounded = Math.round(amount * 100) / 100;
  const baht = Math.floor(rounded);
  const satang = Math.round((rounded - baht) * 100);

  let text = integerToThaiText(baht) + "บาท";
  if (satang > 0) {
    text += integerToThaiText(satang) + "สตางค์";
  } else {
    text += "ถ้วน";
  }
  return text;
}

export function formatMoneyWithText(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return "-";
  return `${amount.toLocaleString("th-TH")} บาท (${bahtText(amount)})`;
}
