import { Fragment } from "react";
import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import ReportShell from "../ReportShell";

function monthsBack(n: number) {
  const now = new Date();
  const arr: { key: string; label: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: `${d.getMonth() + 1}/${d.getFullYear() + 543}` });
  }
  return arr;
}

export default async function MetersReportPage() {
  const { building } = await requireAccess("report");
  const months = monthsBack(6);
  const monthKeys = months.map((m) => m.key);

  const readings = await prisma.meterReading.findMany({
    where: { buildingId: building.id, readingMonth: { in: monthKeys } },
    include: { room: true },
  });

  const roomIds = Array.from(new Set(readings.map((r) => r.roomId)));
  const rooms = await prisma.room.findMany({ where: { id: { in: roomIds } }, orderBy: { roomNumber: "asc" } });

  function cell(roomId: number, monthKey: string) {
    return readings.find((r) => r.roomId === roomId && r.readingMonth === monthKey);
  }

  const excelHeaders = ["ห้อง", ...months.flatMap((m) => [`${m.label} น้ำ`, `${m.label} ไฟ`]), "รวมน้ำ", "รวมไฟ"];
  const excelRows = rooms.map((room) => {
    let totalWater = 0;
    let totalElectric = 0;
    const cells = months.flatMap((m) => {
      const r = cell(room.id, m.key);
      totalWater += r?.waterUnits ?? 0;
      totalElectric += r?.electricUnits ?? 0;
      return [r?.waterUnits ?? "-", r?.electricUnits ?? "-"];
    });
    return [room.roomNumber, ...cells, totalWater, totalElectric];
  });

  return (
    <ReportShell
      title="รายงานมิเตอร์น้ำ-ไฟ (เทียบรายเดือน)"
      subtitle={`${building.name} · ย้อนหลัง 6 เดือน`}
      filenamePrefix="meters"
      excelHeaders={excelHeaders}
      excelRows={excelRows}
    >
      <div style={{ overflowX: "auto" }}>
        <table>
          <thead>
            <tr>
              <th rowSpan={2}>ห้อง</th>
              {months.map((m) => (
                <th key={m.key} colSpan={2} style={{ textAlign: "center" }}>
                  {m.label}
                </th>
              ))}
              <th rowSpan={2}>รวมน้ำ</th>
              <th rowSpan={2}>รวมไฟ</th>
            </tr>
            <tr>
              {months.map((m) => (
                <Fragment key={m.key}>
                  <th>น้ำ</th>
                  <th>ไฟ</th>
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {rooms.map((room) => {
              let totalWater = 0;
              let totalElectric = 0;
              return (
                <tr key={room.id}>
                  <td>{room.roomNumber}</td>
                  {months.map((m) => {
                    const r = cell(room.id, m.key);
                    totalWater += r?.waterUnits ?? 0;
                    totalElectric += r?.electricUnits ?? 0;
                    return (
                      <Fragment key={m.key}>
                        <td>{r?.waterUnits ?? "-"}</td>
                        <td>{r?.electricUnits ?? "-"}</td>
                      </Fragment>
                    );
                  })}
                  <td>{totalWater}</td>
                  <td>{totalElectric}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rooms.length === 0 && <p className="empty">ไม่มีข้อมูลมิเตอร์ในช่วงนี้</p>}
    </ReportShell>
  );
}
