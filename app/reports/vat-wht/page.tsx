import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import ReportShell from "../ReportShell";

function monthsBack(n: number) {
  const now = new Date();
  const arr: { year: number; month: number; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push({ year: d.getFullYear(), month: d.getMonth(), label: `${d.getMonth() + 1}/${d.getFullYear() + 543}` });
  }
  return arr;
}

export default async function VatWhtReportPage() {
  const { building } = await requireAccess("report");
  const months = monthsBack(6);
  const rangeStart = new Date(months[0].year, months[0].month, 1);

  const expenses = await prisma.expense.findMany({
    where: { buildingId: building.id, date: { gte: rangeStart } },
    include: { lineItems: true },
  });

  const rows = months.map(({ year, month, label }) => {
    const inMonth = expenses.filter((e) => new Date(e.date).getFullYear() === year && new Date(e.date).getMonth() === month);
    let purchaseBeforeVat = 0;
    let vatTotal = 0;
    let whtTotal = 0;
    let docsWithVatOrWht = 0;
    for (const e of inMonth) {
      const vatSum = e.lineItems.reduce((s, li) => s + li.vatAmount, 0);
      const beforeVat = e.lineItems.reduce((s, li) => s + (li.vatMode === "included" ? li.amount - li.vatAmount : li.amount), 0);
      purchaseBeforeVat += beforeVat;
      vatTotal += vatSum;
      whtTotal += e.whtAmount ?? 0;
      if (vatSum > 0 || e.whtAmount) docsWithVatOrWht++;
    }
    return { label, purchaseBeforeVat, vatTotal, whtTotal, docsWithVatOrWht };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      purchaseBeforeVat: acc.purchaseBeforeVat + r.purchaseBeforeVat,
      vatTotal: acc.vatTotal + r.vatTotal,
      whtTotal: acc.whtTotal + r.whtTotal,
      docsWithVatOrWht: acc.docsWithVatOrWht + r.docsWithVatOrWht,
    }),
    { purchaseBeforeVat: 0, vatTotal: 0, whtTotal: 0, docsWithVatOrWht: 0 }
  );

  return (
    <ReportShell
      title="สรุปภาษีซื้อ-ขาย (VAT / หัก ณ ที่จ่าย)"
      subtitle={`${building.name} · ย้อนหลัง 6 เดือน (เฉพาะฝั่งซื้อ — ค่าเช่าไม่มี VAT)`}
      filenamePrefix="vat-wht"
      excelHeaders={["เดือน", "ยอดซื้อก่อน VAT", "ภาษีซื้อ (VAT)", "ยอดหัก ณ ที่จ่าย", "จำนวนบิลที่มี VAT/WHT"]}
      excelRows={rows.map((r) => [r.label, r.purchaseBeforeVat, r.vatTotal, r.whtTotal, r.docsWithVatOrWht])}
    >
      <table>
        <thead>
          <tr>
            <th>เดือน</th>
            <th>ยอดซื้อก่อน VAT</th>
            <th>ภาษีซื้อ (VAT)</th>
            <th>ยอดหัก ณ ที่จ่าย</th>
            <th>จำนวนบิลที่มี VAT/WHT</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td>฿{r.purchaseBeforeVat.toLocaleString()}</td>
              <td>฿{r.vatTotal.toLocaleString()}</td>
              <td>฿{r.whtTotal.toLocaleString()}</td>
              <td>{r.docsWithVatOrWht}</td>
            </tr>
          ))}
          <tr>
            <td>
              <strong>รวมทั้งช่วง</strong>
            </td>
            <td>
              <strong>฿{totals.purchaseBeforeVat.toLocaleString()}</strong>
            </td>
            <td>
              <strong>฿{totals.vatTotal.toLocaleString()}</strong>
            </td>
            <td>
              <strong>฿{totals.whtTotal.toLocaleString()}</strong>
            </td>
            <td>
              <strong>{totals.docsWithVatOrWht}</strong>
            </td>
          </tr>
        </tbody>
      </table>
      <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
        หมายเหตุ: ยอดหัก ณ ที่จ่ายเป็น memo field ที่กรอกเอง ไม่ได้คำนวณอัตโนมัติ ใช้เป็นข้อมูลอ้างอิงเบื้องต้นเท่านั้น
      </p>
    </ReportShell>
  );
}
