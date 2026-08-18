import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import ReportShell from "../ReportShell";

function monthsBack(n: number) {
  const now = new Date();
  const arr: { start: Date; end: Date; label: string; days: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    arr.push({ start, end, label: `${start.getMonth() + 1}/${start.getFullYear() + 543}`, days: end.getDate() });
  }
  return arr;
}

function overlapDays(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  const start = aStart > bStart ? aStart : bStart;
  const end = aEnd < bEnd ? aEnd : bEnd;
  const diff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24) + 1;
  return Math.max(0, Math.round(diff));
}

export default async function OccupancyRateReportPage() {
  const { building } = await requireAccess("report");
  const months = monthsBack(6);
  const rangeStart = months[0].start;

  const [roomCount, occupancies] = await Promise.all([
    prisma.room.count({ where: { buildingId: building.id } }),
    prisma.roomOccupancy.findMany({
      where: { room: { buildingId: building.id }, checkinDate: { lte: months[months.length - 1].end }, OR: [{ movedOutDate: null }, { movedOutDate: { gte: rangeStart } }] },
    }),
  ]);

  const rows = months.map((m) => {
    let roomNights = 0;
    for (const o of occupancies) {
      const occStart = new Date(o.checkinDate);
      const occEnd = o.movedOutDate ? new Date(o.movedOutDate) : m.end;
      roomNights += overlapDays(occStart, occEnd, m.start, m.end);
    }
    const maxPossible = roomCount * m.days;
    const rate = maxPossible > 0 ? Math.round((roomNights / maxPossible) * 1000) / 10 : 0;
    return { label: m.label, roomCount, roomNights, maxPossible, rate };
  });
  const avgRate = rows.length > 0 ? Math.round((rows.reduce((s, r) => s + r.rate, 0) / rows.length) * 10) / 10 : 0;

  return (
    <ReportShell
      title="อัตราการเข้าพัก (Occupancy Rate)"
      subtitle={`${building.name} · คำนวณจาก room-nights ย้อนหลัง 6 เดือน`}
      filenamePrefix="occupancy-rate"
      excelHeaders={["เดือน", "ห้องทั้งหมด", "Room-nights ที่มีผู้เช่า", "Room-nights สูงสุด", "% อัตราเข้าพัก"]}
      excelRows={rows.map((r) => [r.label, r.roomCount, r.roomNights, r.maxPossible, `${r.rate}%`])}
    >
      <table>
        <thead>
          <tr>
            <th>เดือน</th>
            <th>ห้องทั้งหมด</th>
            <th>Room-nights ที่มีผู้เช่า</th>
            <th>Room-nights สูงสุด</th>
            <th>% อัตราเข้าพัก</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td>{r.roomCount}</td>
              <td>{r.roomNights}</td>
              <td>{r.maxPossible}</td>
              <td>{r.rate}%</td>
            </tr>
          ))}
          <tr>
            <td colSpan={4}>
              <strong>ค่าเฉลี่ยทั้งช่วง</strong>
            </td>
            <td>
              <strong>{avgRate}%</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </ReportShell>
  );
}
