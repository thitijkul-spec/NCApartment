import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { formatDateBE } from "@/lib/date-utils";
import ReportShell from "../ReportShell";

const STATUS_LABEL: Record<string, string> = { pending: "รอดำเนินการ", in_progress: "กำลังดำเนินการ", completed: "เสร็จสิ้น" };

export default async function RepairsReportPage({ searchParams }: { searchParams: { status?: string } }) {
  const { building } = await requireAccess("report");
  const statusFilter = searchParams.status;

  const requests = await prisma.repairRequest.findMany({
    where: { buildingId: building.id, status: statusFilter || undefined },
    include: { room: true, assignedTechnician: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <ReportShell
      title="รายงานแจ้งซ่อม"
      subtitle={building.name}
      filenamePrefix="repairs"
      excelHeaders={["ห้อง", "หัวข้อ", "ประเภท", "ความเร่งด่วน", "สถานะ", "ช่าง", "ที่มา", "วันที่แจ้ง", "วันที่เสร็จ"]}
      excelRows={requests.map((r) => [
        r.room.roomNumber,
        r.title,
        r.categoryName,
        r.priority,
        STATUS_LABEL[r.status] ?? r.status,
        r.assignedTechnician?.name ?? "-",
        r.source === "line_liff" ? "LINE" : "แอดมิน",
        formatDateBE(r.createdAt),
        r.completedAt ? formatDateBE(r.completedAt) : "-",
      ])}
      filterBar={
        <div style={{ display: "flex", gap: 8 }}>
          <a href="/reports/repairs" className={`secondary btn${!statusFilter ? " active" : ""}`}>
            ทั้งหมด
          </a>
          {Object.entries(STATUS_LABEL).map(([k, v]) => (
            <a key={k} href={`/reports/repairs?status=${k}`} className={`secondary btn${statusFilter === k ? " active" : ""}`}>
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
            <th>หัวข้อ</th>
            <th>ประเภท</th>
            <th>ความเร่งด่วน</th>
            <th>สถานะ</th>
            <th>ช่าง</th>
            <th>ที่มา</th>
            <th>วันที่แจ้ง</th>
            <th>วันที่เสร็จ</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((r) => (
            <tr key={r.id}>
              <td>{r.room.roomNumber}</td>
              <td>{r.title}</td>
              <td>{r.categoryName}</td>
              <td>{r.priority}</td>
              <td>{STATUS_LABEL[r.status] ?? r.status}</td>
              <td>{r.assignedTechnician?.name ?? "-"}</td>
              <td>{r.source === "line_liff" ? "LINE" : "แอดมิน"}</td>
              <td>{formatDateBE(r.createdAt)}</td>
              <td>{r.completedAt ? formatDateBE(r.completedAt) : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {requests.length === 0 && <p className="empty">ไม่มีข้อมูล</p>}
    </ReportShell>
  );
}
