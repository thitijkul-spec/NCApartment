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

export default async function TurnoverReportPage() {
  const { building } = await requireAccess("report");
  const months = monthsBack(12);
  const rangeStart = new Date(months[0].year, months[0].month, 1);

  const occupancies = await prisma.roomOccupancy.findMany({
    where: { room: { buildingId: building.id }, OR: [{ checkinDate: { gte: rangeStart } }, { movedOutDate: { gte: rangeStart } }] },
  });

  const rows = months.map(({ year, month, label }) => {
    const inMonth = (d: Date | null) => !!d && d.getFullYear() === year && d.getMonth() === month;
    const newCount = occupancies.filter((o) => inMonth(new Date(o.checkinDate))).length;
    const movedOutCount = occupancies.filter((o) => inMonth(o.movedOutDate)).length;
    return { label, newCount, movedOutCount, net: newCount - movedOutCount };
  });
  const totalNew = rows.reduce((s, r) => s + r.newCount, 0);
  const totalOut = rows.reduce((s, r) => s + r.movedOutCount, 0);

  return (
    <ReportShell
      title="อัตราการเข้า-ออกผู้เช่า (Turnover)"
      subtitle={`${building.name} · ย้อนหลัง 12 เดือน`}
      filenamePrefix="turnover"
      excelHeaders={["เดือน", "ผู้เช่าใหม่", "ย้ายออก", "สุทธิ"]}
      excelRows={rows.map((r) => [r.label, r.newCount, r.movedOutCount, r.net])}
    >
      <table>
        <thead>
          <tr>
            <th>เดือน</th>
            <th>ผู้เช่าใหม่</th>
            <th>ย้ายออก</th>
            <th>สุทธิ</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <td>{r.label}</td>
              <td>{r.newCount}</td>
              <td>{r.movedOutCount}</td>
              <td>{r.net >= 0 ? `+${r.net}` : r.net}</td>
            </tr>
          ))}
          <tr>
            <td>
              <strong>รวมทั้งช่วง</strong>
            </td>
            <td>
              <strong>{totalNew}</strong>
            </td>
            <td>
              <strong>{totalOut}</strong>
            </td>
            <td>
              <strong>{totalNew - totalOut}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </ReportShell>
  );
}
