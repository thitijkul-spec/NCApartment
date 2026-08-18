import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { formatDateBE } from "@/lib/date-utils";
import ReportShell from "../ReportShell";

const STATUS_LABEL: Record<string, string> = { held: "ถืออยู่", returned: "คืนแล้ว", forfeited: "ริบแล้ว" };

export default async function DepositsReportPage({ searchParams }: { searchParams: { status?: string } }) {
  const { building } = await requireAccess("report");
  const statusFilter = searchParams.status;

  const deposits = await prisma.deposit.findMany({
    where: { room: { buildingId: building.id }, status: statusFilter ? statusFilter : undefined },
    include: { room: true, contract: { include: { tenant: true } } },
    orderBy: { collectedDate: "desc" },
  });

  const heldTotal = deposits.filter((d) => d.status === "held").reduce((s, d) => s + d.amount, 0);

  return (
    <ReportShell
      title="รายงานเงินมัดจำ"
      subtitle={building.name}
      filenamePrefix="deposits"
      excelHeaders={["ห้อง", "ผู้เช่า", "วันที่ทำสัญญา", "จำนวนเงินมัดจำ", "สถานะ", "วันที่คืน/ริบ"]}
      excelRows={deposits.map((d) => [
        d.room.roomNumber,
        d.contract?.tenant.name ?? "-",
        formatDateBE(d.collectedDate),
        d.amount,
        STATUS_LABEL[d.status],
        d.returnedDate ? formatDateBE(d.returnedDate) : d.forfeitedDate ? formatDateBE(d.forfeitedDate) : "-",
      ])}
      filterBar={
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/reports/deposits" className={`secondary btn${!statusFilter ? " active" : ""}`}>
            ทุกสถานะ
          </a>
          <a href="/reports/deposits?status=held" className={`secondary btn${statusFilter === "held" ? " active" : ""}`}>
            ถืออยู่
          </a>
          <a href="/reports/deposits?status=returned" className={`secondary btn${statusFilter === "returned" ? " active" : ""}`}>
            คืนแล้ว
          </a>
          <a href="/reports/deposits?status=forfeited" className={`secondary btn${statusFilter === "forfeited" ? " active" : ""}`}>
            ริบแล้ว
          </a>
        </div>
      }
    >
      <table>
        <thead>
          <tr>
            <th>ห้อง</th>
            <th>ผู้เช่า</th>
            <th>วันที่ทำสัญญา</th>
            <th>จำนวนเงินมัดจำ</th>
            <th>สถานะ</th>
            <th>วันที่คืน/ริบ</th>
          </tr>
        </thead>
        <tbody>
          {deposits.map((d) => (
            <tr key={d.id}>
              <td>{d.room.roomNumber}</td>
              <td>{d.contract?.tenant.name ?? "-"}</td>
              <td>{formatDateBE(d.collectedDate)}</td>
              <td>฿{d.amount.toLocaleString()}</td>
              <td>{STATUS_LABEL[d.status]}</td>
              <td>{d.returnedDate ? formatDateBE(d.returnedDate) : d.forfeitedDate ? formatDateBE(d.forfeitedDate) : "-"}</td>
            </tr>
          ))}
          <tr>
            <td colSpan={3}>
              <strong>ยอดรวมมัดจำที่ถืออยู่</strong>
            </td>
            <td colSpan={3}>
              <strong>฿{heldTotal.toLocaleString()}</strong>
            </td>
          </tr>
        </tbody>
      </table>
      {deposits.length === 0 && <p className="empty">ไม่มีข้อมูล</p>}
    </ReportShell>
  );
}
