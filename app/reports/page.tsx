import { prisma } from "@/lib/prisma";
import { getDefaultBranch } from "../rooms/actions";
import PrintButton from "../bills/PrintButton";
import { getCurrentUser, hasModuleAccess } from "@/lib/auth";
import { redirect } from "next/navigation";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

export default async function ReportsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasModuleAccess(user, "D")) {
    return <div className="card">ไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
  }

  const branch = await getDefaultBranch();
  const today = new Date();

  const overdueBills = await prisma.bill.findMany({
    where: {
      branchId: branch.id,
      status: { in: ["issued", "partial"] },
      dueDate: { lt: today },
    },
    include: { customer: true, room: true, payments: true },
    orderBy: { dueDate: "asc" },
  });

  const roomTypes = await prisma.roomType.findMany({
    where: { branchId: branch.id },
    include: { rooms: true },
    orderBy: { id: "asc" },
  });

  const last14Days: { date: string; total: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date();
    day.setDate(day.getDate() - i);
    day.setHours(0, 0, 0, 0);
    const dayEnd = new Date(day);
    dayEnd.setHours(23, 59, 59, 999);
    const payments = await prisma.payment.findMany({
      where: { paymentDate: { gte: day, lte: dayEnd } },
    });
    last14Days.push({
      date: day.toLocaleDateString("th-TH", { day: "numeric", month: "short" }),
      total: payments.reduce((s, p) => s + p.amount, 0),
    });
  }
  const maxRevenue = Math.max(1, ...last14Days.map((d) => d.total));

  return (
    <div>
      <h1 className="page-title">รายงาน</h1>

      <div className="card">
        <h2>ลูกค้าค้างชำระ</h2>
        {overdueBills.length === 0 ? (
          <p className="empty">ไม่มีบิลค้างชำระ</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ห้อง</th>
                <th>ลูกค้า</th>
                <th>เบอร์โทร</th>
                <th>ครบกำหนด</th>
                <th>ค้างมา (วัน)</th>
                <th>ยอดค้าง</th>
              </tr>
            </thead>
            <tbody>
              {overdueBills.map((b) => {
                const paid = b.payments.reduce((s, p) => s + p.amount, 0);
                const remaining = b.totalAmount - paid;
                const overdueDays = daysBetween(today, b.dueDate);
                return (
                  <tr key={b.id} style={overdueDays > 30 ? { background: "var(--danger-bg)" } : {}}>
                    <td>{b.room.roomNumber}</td>
                    <td>{b.customer.name}</td>
                    <td>{b.customer.phone}</td>
                    <td>{formatDate(b.dueDate)}</td>
                    <td>{overdueDays}</td>
                    <td>{remaining.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>ห้องว่าง แยกตามประเภท</h2>
        <table>
          <thead>
            <tr>
              <th>ประเภทห้อง</th>
              <th>ห้องทั้งหมด</th>
              <th>ห้องว่าง</th>
              <th>ไม่ว่าง</th>
              <th>ปิดปรับปรุง</th>
            </tr>
          </thead>
          <tbody>
            {roomTypes.map((rt) => {
              const total = rt.rooms.length;
              const available = rt.rooms.filter((r) => r.status === "available").length;
              const unavailable = rt.rooms.filter((r) => r.status === "unavailable").length;
              const blocked = rt.rooms.filter((r) => r.status === "blocked").length;
              return (
                <tr key={rt.id}>
                  <td>{rt.name}</td>
                  <td>{total}</td>
                  <td>{available}</td>
                  <td>{unavailable}</td>
                  <td>{blocked}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>รายได้ย้อนหลัง 14 วัน (จากยอดรับชำระเงิน)</h2>
        <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 160 }}>
          {last14Days.map((d) => (
            <div key={d.date} style={{ textAlign: "center", flex: 1 }}>
              <div
                title={`${d.date}: ${d.total.toLocaleString()} บาท`}
                style={{
                  background: "var(--navy)",
                  height: `${(d.total / maxRevenue) * 120}px`,
                  minHeight: 2,
                  borderRadius: 4,
                }}
              />
              <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>{d.date}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="card no-print">
        <PrintButton label="พิมพ์รายงานนี้ (หรือบันทึกเป็น PDF)" />
      </div>
    </div>
  );
}
