import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { formatDateBE } from "@/lib/date-utils";
import ReportShell from "../ReportShell";

const STATUS_LABEL: Record<string, string> = { arrived: "พัสดุเข้า", notified: "แจ้งลูกบ้านแล้ว", picked_up: "รับพัสดุแล้ว" };

export default async function ParcelsReportPage({ searchParams }: { searchParams: { status?: string } }) {
  const { building } = await requireAccess("report");
  const statusFilter = searchParams.status;
  const settings = await prisma.buildingSettings.findUnique({ where: { buildingId: building.id } });
  const overdueDays = settings?.parcelOverdueDays ?? 3;

  const parcels = await prisma.parcel.findMany({
    where: { buildingId: building.id, status: statusFilter || undefined },
    include: { room: true },
    orderBy: { receivedAt: "desc" },
  });

  function isOverdue(p: (typeof parcels)[number]) {
    if (p.status === "picked_up") return false;
    return (Date.now() - new Date(p.receivedAt).getTime()) / (1000 * 60 * 60 * 24) > overdueDays;
  }

  return (
    <ReportShell
      title="รายงานพัสดุ"
      subtitle={building.name}
      filenamePrefix="parcels"
      excelHeaders={["ห้อง", "ผู้รับ", "สถานะ", "ตกค้าง", "วันที่พัสดุเข้า", "วันที่รับพัสดุ"]}
      excelRows={parcels.map((p) => [
        p.room?.roomNumber ?? "-",
        p.recipientName,
        STATUS_LABEL[p.status] ?? p.status,
        isOverdue(p) ? "ตกค้าง" : "-",
        formatDateBE(p.receivedAt),
        p.pickedUpAt ? formatDateBE(p.pickedUpAt) : "-",
      ])}
      filterBar={
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/reports/parcels" className={`secondary btn${!statusFilter ? " active" : ""}`}>
            ทั้งหมด
          </a>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <a key={k} href={`/reports/parcels?status=${k}`} className={`secondary btn${statusFilter === k ? " active" : ""}`}>
              {v}
            </a>
          ))}
        </div>
      }
    >
      <table>
        <thead>
          <tr>
            <th>ห้อง</th>
            <th>ผู้รับ</th>
            <th>สถานะ</th>
            <th>ตกค้าง</th>
            <th>วันที่พัสดุเข้า</th>
            <th>วันที่รับพัสดุ</th>
          </tr>
        </thead>
        <tbody>
          {parcels.map((p) => (
            <tr key={p.id}>
              <td>{p.room?.roomNumber ?? "-"}</td>
              <td>{p.recipientName}</td>
              <td>{STATUS_LABEL[p.status] ?? p.status}</td>
              <td>{isOverdue(p) ? <span className="badge danger">ตกค้าง</span> : "-"}</td>
              <td>{formatDateBE(p.receivedAt)}</td>
              <td>{p.pickedUpAt ? formatDateBE(p.pickedUpAt) : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {parcels.length === 0 && <p className="empty">ไม่มีข้อมูล</p>}
    </ReportShell>
  );
}
