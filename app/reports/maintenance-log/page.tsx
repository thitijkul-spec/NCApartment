import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { formatDateBE } from "@/lib/date-utils";
import ReportShell from "../ReportShell";

export default async function MaintenanceLogReportPage() {
  const { building } = await requireAccess("report");

  const logs = await prisma.maintenanceLog.findMany({
    where: { buildingId: building.id },
    include: { room: true, equipment: true, technician: true },
    orderBy: { date: "desc" },
  });

  return (
    <ReportShell
      title="รายงานล้างแอร์/บำรุงรักษาอุปกรณ์ส่วนกลาง"
      subtitle={building.name}
      filenamePrefix="maintenance-log"
      excelHeaders={["ประเภท", "ห้อง/อุปกรณ์", "วันที่บำรุงรักษา", "ช่าง", "หมายเหตุ"]}
      excelRows={logs.map((l) => [
        l.category === "aircon" ? "ล้างแอร์" : "อุปกรณ์ส่วนกลาง",
        l.category === "aircon" ? l.room?.roomNumber ?? "-" : l.equipment?.name ?? "-",
        formatDateBE(l.date),
        l.technician?.name ?? "-",
        l.notes ?? "-",
      ])}
    >
      <table>
        <thead>
          <tr>
            <th>ประเภท</th>
            <th>ห้อง/อุปกรณ์</th>
            <th>วันที่บำรุงรักษา</th>
            <th>ช่าง</th>
            <th>หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((l) => (
            <tr key={l.id}>
              <td>{l.category === "aircon" ? "ล้างแอร์" : "อุปกรณ์ส่วนกลาง"}</td>
              <td>{l.category === "aircon" ? l.room?.roomNumber ?? "-" : l.equipment?.name ?? "-"}</td>
              <td>{formatDateBE(l.date)}</td>
              <td>{l.technician?.name ?? "-"}</td>
              <td>{l.notes ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {logs.length === 0 && <p className="empty">ไม่มีข้อมูล</p>}
    </ReportShell>
  );
}
