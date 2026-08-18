import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import ReportShell from "../ReportShell";

export default async function ByAccountReportPage() {
  const { building } = await requireAccess("report");

  const accounts = await prisma.account.findMany({ where: { buildingId: building.id }, orderBy: { name: "asc" } });
  const [payments, otherIncomePayments] = await Promise.all([
    prisma.payment.findMany({ where: { bill: { buildingId: building.id }, accountId: { not: null } }, select: { accountId: true, amount: true } }),
    prisma.otherIncomePayment.findMany({ where: { otherIncome: { buildingId: building.id } }, select: { accountId: true, amount: true } }),
  ]);

  const rows = accounts
    .map((a) => {
      const billTx = payments.filter((p) => p.accountId === a.id);
      const incomeTx = otherIncomePayments.filter((p) => p.accountId === a.id);
      const count = billTx.length + incomeTx.length;
      const total = billTx.reduce((s, p) => s + p.amount, 0) + incomeTx.reduce((s, p) => s + p.amount, 0);
      return { name: a.name, type: a.type, count, total };
    })
    .filter((r) => r.count > 0);

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  return (
    <ReportShell
      title="สรุปยอดตามบัญชีที่รับเงิน"
      subtitle={building.name}
      filenamePrefix="by-account"
      excelHeaders={["ชื่อบัญชี", "ประเภทบัญชี", "จำนวนรายการ", "ยอดรวม"]}
      excelRows={rows.map((r) => [r.name, r.type, r.count, r.total])}
    >
      <table>
        <thead>
          <tr>
            <th>ชื่อบัญชี</th>
            <th>ประเภทบัญชี</th>
            <th>จำนวนรายการ</th>
            <th>ยอดรวม</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td>{r.name}</td>
              <td>{r.type}</td>
              <td>{r.count}</td>
              <td>฿{r.total.toLocaleString()}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={3}>
              <strong>รวมทั้งหมด</strong>
            </td>
            <td>
              <strong>฿{grandTotal.toLocaleString()}</strong>
            </td>
          </tr>
        </tbody>
      </table>
      {rows.length === 0 && <p className="empty">ไม่มีข้อมูล</p>}
    </ReportShell>
  );
}
