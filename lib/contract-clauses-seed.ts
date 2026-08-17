import { prisma } from "./prisma";

export const DEFAULT_CONTRACT_CLAUSES = [
  {
    title: "ห้องพักที่เช่า",
    titleEn: "Room Leased",
    body: "ผู้ให้เช่าตกลงให้เช่าและผู้เช่าตกลงเช่าห้องพักเลขที่ {หมายเลขห้อง} ชั้น {ชั้น} ตั้งอยู่ที่ {ที่อยู่หอพัก} เพื่อใช้เป็นที่พักอาศัยส่วนบุคคลเท่านั้น ห้ามใช้เพื่อประกอบกิจการใดๆ หรือให้เช่าช่วงโดยไม่ได้รับความยินยอมเป็นลายลักษณ์อักษรจากผู้ให้เช่า",
    bodyEn:
      "The Lessor agrees to lease and the Lessee agrees to lease room no. {หมายเลขห้อง}, floor {ชั้น}, located at {ที่อยู่หอพัก}, for residential purposes only. The Lessee shall not use the premises for any business purpose or sublet without the Lessor's prior written consent.",
  },
  {
    title: "ระยะเวลาการเช่า",
    titleEn: "Lease Term",
    body: "สัญญาฉบับนี้มีกำหนดระยะเวลาตั้งแต่วันที่ {วันเริ่มสัญญา} ถึงวันที่ {วันสิ้นสุดสัญญา} หากผู้เช่าประสงค์จะต่อสัญญา ต้องแจ้งเป็นลายลักษณ์อักษรล่วงหน้าไม่น้อยกว่า {จำนวนวันแจ้งล่วงหน้า} วันก่อนวันสิ้นสุดสัญญา มิฉะนั้นให้ถือว่าสัญญาสิ้นสุดลงตามกำหนด",
    bodyEn:
      "This Agreement is effective from {วันเริ่มสัญญา} to {วันสิ้นสุดสัญญา}. Should the Lessee wish to renew, written notice must be given at least {จำนวนวันแจ้งล่วงหน้า} days before expiration; otherwise this Agreement shall terminate as scheduled.",
  },
  {
    title: "ค่าเช่าและกำหนดชำระ",
    titleEn: "Rent and Payment Due Date",
    body: "ผู้เช่าตกลงชำระค่าเช่าเดือนละ {ค่าเช่า} ภายในวันที่ {วันกำหนดชำระ} ของทุกเดือน หากชำระล่าช้าเกินกำหนด ผู้เช่าตกลงชำระค่าปรับในอัตราวันละ {ค่าปรับล่าช้า} นับแต่วันถัดจากวันครบกำหนดจนกว่าจะชำระครบถ้วน",
    bodyEn:
      "The Lessee agrees to pay monthly rent of {ค่าเช่า} Baht on or before the {วันกำหนดชำระ} of each month. In case of late payment, the Lessee agrees to pay a late fee of {ค่าปรับล่าช้า} Baht per day from the day following the due date until paid in full.",
  },
  {
    title: "เงินประกันการเช่า",
    titleEn: "Security Deposit",
    body: "ผู้เช่าวางเงินประกันจำนวน {เงินประกัน} ไว้กับผู้ให้เช่าในวันทำสัญญา ผู้ให้เช่าจะคืนเงินประกันภายใน {จำนวนวันคืนเงินประกัน} วัน นับแต่วันที่ผู้เช่าส่งมอบห้องพักคืนโดยปราศจากความเสียหายและไม่มีค่าใช้จ่ายค้างชำระ หากมีความเสียหายหรือค่าใช้จ่ายค้างชำระ ผู้ให้เช่ามีสิทธิหักจากเงินประกันดังกล่าวได้",
    bodyEn:
      "The Lessee shall place a security deposit of {เงินประกัน} Baht with the Lessor upon signing. The Lessor shall refund the deposit within {จำนวนวันคืนเงินประกัน} days after the Lessee returns the room without damage and with no outstanding charges. The Lessor may deduct any damage or outstanding charges from the deposit.",
  },
  {
    title: "ค่าสาธารณูปโภคและค่าใช้จ่ายเพิ่มเติม",
    titleEn: "Utilities and Additional Charges",
    body: "ผู้เช่าตกลงชำระค่าน้ำประปา ค่าไฟฟ้า ตามอัตราที่ผู้ให้เช่ากำหนด พร้อมค่าเช่าประจำเดือน รวมถึงค่าอุปกรณ์ไฟฟ้าเพิ่มเติม (ถ้ามี) {ค่าอุปกรณ์ไฟฟ้า} ต่อเดือน และค่าครุภัณฑ์/เฟอร์นิเจอร์เพิ่มเติม (ถ้ามี) {ค่าครุภัณฑ์เฟอร์นิเจอร์} ต่อเดือน",
    bodyEn:
      "The Lessee agrees to pay for water and electricity at the Lessor's rates together with the monthly rent, including an additional electrical equipment fee (if any) of {ค่าอุปกรณ์ไฟฟ้า} Baht/month and an additional furniture/equipment fee (if any) of {ค่าครุภัณฑ์เฟอร์นิเจอร์} Baht/month.",
  },
  {
    title: "ทรัพย์สินและการดูแลรักษาห้องพัก",
    titleEn: "Property and Room Maintenance",
    body: "ผู้เช่าได้ตรวจรับห้องพักพร้อมเฟอร์นิเจอร์และอุปกรณ์ตามสภาพที่ตรวจสอบร่วมกันแล้ว ผู้เช่าต้องดูแลรักษาทรัพย์สินและความสะอาดของห้องพักให้อยู่ในสภาพเรียบร้อย ไม่ต่อเติม ดัดแปลง หรือเจาะผนัง/โครงสร้างโดยไม่ได้รับอนุญาตเป็นลายลักษณ์อักษร หากเกิดความเสียหายจากการใช้งานผิดวิธีหรือความประมาทเลินเล่อของผู้เช่า ผู้เช่าต้องรับผิดชอบค่าซ่อมแซมหรือชดใช้ตามราคาที่แท้จริง",
    bodyEn:
      "The Lessee has inspected and accepted the room together with furniture and equipment in the jointly-inspected condition. The Lessee shall maintain such property and keep the room clean and in good order, and shall not renovate, alter, or drill into walls/structure without prior written permission. Damage arising from misuse or negligence shall be repaired or compensated by the Lessee at actual cost.",
  },
  {
    title: "กฎระเบียบการอยู่อาศัย",
    titleEn: "House Rules",
    body: "ผู้เช่าตกลงปฏิบัติตามกฎระเบียบของหอพัก ได้แก่ {อนุญาต/ไม่อนุญาตให้เลี้ยงสัตว์}, {อนุญาต/ห้ามสูบบุหรี่ในอาคาร} และกฎเพิ่มเติมอื่นตามที่ระบุแนบท้ายสัญญานี้ (ถ้ามี) การฝ่าฝืนซ้ำหลังได้รับการตักเตือนเป็นลายลักษณ์อักษร ผู้ให้เช่ามีสิทธิบอกเลิกสัญญาได้ทันที",
    bodyEn:
      "The Lessee agrees to comply with the dormitory's house rules, including {pets allowed/not allowed}, {smoking prohibited/allowed} inside the building, and any additional rules attached hereto (if any). Repeated violation after written warning entitles the Lessor to terminate this Agreement immediately.",
  },
  {
    title: "การผิดนัดชำระ",
    titleEn: "Default in Payment",
    body: "หากผู้เช่าค้างชำระค่าเช่าหรือค่าใช้จ่ายใดๆ ติดต่อกันเกิน {จำนวนวันค้างชำระที่อนุญาต} วันนับแต่วันครบกำหนดชำระ ผู้ให้เช่ามีสิทธิบอกเลิกสัญญาและให้ผู้เช่าออกจากห้องพักได้ทันทีโดยไม่ต้องแจ้งล่วงหน้า",
    bodyEn:
      "If the Lessee fails to pay rent or any charges for more than {จำนวนวันค้างชำระที่อนุญาต} consecutive days from the due date, the Lessor may terminate this Agreement and require the Lessee to vacate immediately without prior notice.",
  },
  {
    title: "การบอกเลิกสัญญาก่อนกำหนด",
    titleEn: "Early Termination",
    body: "คู่สัญญาฝ่ายใดฝ่ายหนึ่งประสงค์จะบอกเลิกสัญญาก่อนครบกำหนดระยะเวลาเช่า ต้องแจ้งเป็นลายลักษณ์อักษรล่วงหน้าไม่น้อยกว่า {จำนวนวันแจ้งล่วงหน้า} วัน หากผู้เช่าเป็นฝ่ายบอกเลิกโดยไม่แจ้งล่วงหน้าตามกำหนด ผู้ให้เช่ามีสิทธิไม่คืนเงินประกันการเช่า",
    bodyEn:
      "Either party wishing to terminate this Agreement before the lease term ends must give written notice at least {จำนวนวันแจ้งล่วงหน้า} days in advance. If the Lessee terminates without such notice, the Lessor is entitled to withhold the security deposit.",
  },
  {
    title: "เหตุสุดวิสัยและความรับผิด",
    titleEn: "Force Majeure and Liability",
    body: "ในกรณีเกิดเหตุสุดวิสัย อัคคีภัย หรือภัยธรรมชาติที่มิได้เกิดจากความประมาทของฝ่ายใดฝ่ายหนึ่ง คู่สัญญาทั้งสองฝ่ายไม่ต้องรับผิดต่อกัน เว้นแต่ความเสียหายที่เกิดจากความประมาทเลินเล่อของผู้เช่า ซึ่งผู้เช่าต้องเป็นผู้รับผิดชอบ",
    bodyEn:
      "In the event of force majeure, fire, or natural disaster not caused by either party's negligence, neither party shall be liable to the other, except for damage caused by the Lessee's negligence, for which the Lessee shall be responsible.",
  },
  {
    title: "พยานและเอกสารแนบท้าย",
    titleEn: "Witnesses and Attachments",
    body: "ในกรณีที่มีพยาน ให้พยานลงลายมือชื่อรับรองไว้ในสัญญาฉบับนี้ กฎเพิ่มเติมหรือเงื่อนไขพิเศษอื่นใดที่ตกลงกันเพิ่มเติม ให้ถือเป็นส่วนหนึ่งของสัญญาฉบับนี้",
    bodyEn:
      "Where witnesses are present, they shall sign this Agreement to certify it. Any additional rules or special conditions agreed upon shall be deemed part of this Agreement.",
  },
  {
    title: "ผลผูกพันของสัญญา",
    titleEn: "Binding Effect",
    body: "สัญญาฉบับนี้ทำขึ้นเป็นหลักฐาน คู่สัญญาทั้งสองฝ่ายได้อ่านและเข้าใจข้อความในสัญญาโดยตลอดแล้ว เห็นว่าถูกต้องตรงตามเจตนา จึงลงลายมือชื่อไว้เป็นสำคัญ",
    bodyEn:
      "This Agreement is made as evidence. Both parties have read and fully understood the contents of this Agreement and agree that it accurately reflects their intent, and have therefore signed below.",
  },
];

/** ข้อปิดท้ายคงที่ (governing language) — ต่อท้ายเสมอเมื่อ isBilingual=true, ไม่เก็บใน DB, ปิด/ลบไม่ได้ */
export const BILINGUAL_GOVERNING_CLAUSE = {
  title: "ภาษาที่ใช้บังคับ",
  titleEn: "Governing Language",
  body: "ในกรณีที่สัญญาฉบับนี้จัดทำเป็นสองภาษา หากข้อความในภาษาไทยและภาษาอังกฤษมีความขัดแย้งหรือตีความแตกต่างกัน ให้ยึดถือข้อความภาษาไทยเป็นหลักในการตีความและบังคับใช้ทุกกรณี",
  bodyEn:
    "In the event this Agreement is prepared in both Thai and English, should there be any discrepancy or conflict in interpretation between the two versions, the Thai version shall prevail and govern in all respects.",
};

export async function seedDefaultContractClauses(buildingId: number) {
  await prisma.contractClauseTemplate.createMany({
    data: DEFAULT_CONTRACT_CLAUSES.map((c, i) => ({
      buildingId,
      order: i + 1,
      title: c.title,
      titleEn: c.titleEn,
      body: c.body,
      bodyEn: c.bodyEn,
      isDefaultIncluded: true,
    })),
  });
}
