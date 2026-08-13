import { prisma } from "@/lib/prisma";
import { getDefaultBranch } from "../rooms/actions";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "owner") {
    return <div className="card">หน้านี้สำหรับเจ้าของเท่านั้น</div>;
  }

  const branch = await getDefaultBranch();
  const today = new Date();

  const payments = await prisma.payment.findMany({ where: { bill: { branchId: branch.id } } });
  const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);

  const expenses = await prisma.expense.findMany({ where: { branchId: branch.id } });
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const unpaidBills = await prisma.bill.findMany({
    where: { branchId: branch.id, status: { in: ["issued", "partial"] } },
    include: { payments: true },
  });
  const totalOutstanding = unpaidBills.reduce((s, b) => {
    const paid = b.payments.reduce((s2, p) => s2 + p.amount, 0);
    return s + Math.max(0, b.totalAmount - paid);
  }, 0);

  const rooms = await prisma.room.findMany({ where: { branchId: branch.id } });
  const occupiedRooms = rooms.filter((r) => r.status !== "available").length;
  const occupancyRate = rooms.length > 0 ? Math.round((occupiedRooms / rooms.length) * 100) : 0;

  const topOverdue = await prisma.bill.findMany({
    where: {
      branchId: branch.id,
      status: { in: ["issued", "partial"] },
      dueDate: { lt: new Date(today.getFullYear(), today.getMonth() - 1, today.getDate()) },
    },
    include: { customer: true, room: true, payments: true },
    orderBy: { dueDate: "asc" },
    take: 5,
  });

  const sixtyDaysFromNow = new Date();
  sixtyDaysFromNow.setDate(sixtyDaysFromNow.getDate() + 60);
  const expiringContracts = await prisma.contract.findMany({
    where: {
      status: "active",
      endDate: { lte: sixtyDaysFromNow, gte: today },
    },
    include: { room: true, customer: true },
    orderBy: { endDate: "asc" },
  });

  const topMaintenance = await prisma.maintenanceRequest.findMany({
    where: { branchId: branch.id, status: { in: ["new", "assigned", "in_progress"] } },
    include: { room: true },
    orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    take: 5,
  });

  return (
    <div>
      <h1 className="page-title">แดชบอร์ดเจ้าของ</h1>

      <div className="card">
        <div className="form-row">
          <div className="field">
            <label>รายได้รวม (จากที่รับชำระแล้ว)</label>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--success)" }}>
              {totalRevenue.toLocaleString()}
            </div>
          </div>
          <div className="field">
            <label>ค่าใช้จ่ายรวม</label>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--danger)" }}>
              {totalExpenses.toLocaleString()}
            </div>
          </div>
          <div className="field">
            <label>กำไรสุทธิ</label>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--navy)" }}>
              {(totalRevenue - totalExpenses).toLocaleString()}
            </div>
          </div>
          <div className="field">
            <label>ยอดค้างชำระ</label>
            <div style={{ fontSize: 24, fontWeight: 700, color: "var(--warning)" }}>
              {totalOutstanding.toLocaleString()}
            </div>
          </div>
          <div className="field">
            <label>อัตราการเข้าพัก</label>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{occupancyRate}%</div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>ลูกค้าค้างชำระเกิน 1 เดือน (5 อันดับแรก)</h2>
        {topOverdue.length === 0 ? (
          <p className="empty">ไม่มี</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ห้อง</th>
                <th>ลูกค้า</th>
                <th>เบอร์โทร</th>
                <th>ครบกำหนด</th>
                <th>ยอดค้าง</th>
              </tr>
            </thead>
            <tbody>
              {topOverdue.map((b) => {
                const paid = b.payments.reduce((s, p) => s + p.amount, 0);
                return (
                  <tr key={b.id}>
                    <td>{b.room.roomNumber}</td>
                    <td>{b.customer.name}</td>
                    <td>{b.customer.phone}</td>
                    <td>{formatDate(b.dueDate)}</td>
                    <td>{(b.totalAmount - paid).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>สัญญาใกล้หมดอายุ (60 วัน)</h2>
        {expiringContracts.length === 0 ? (
          <p className="empty">ไม่มี</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ห้อง</th>
                <th>ลูกค้า</th>
                <th>สิ้นสุดสัญญา</th>
              </tr>
            </thead>
            <tbody>
              {expiringContracts.map((c) => (
                <tr key={c.id}>
                  <td>{c.room.roomNumber}</td>
                  <td>{c.customer.name}</td>
                  <td>{formatDate(c.endDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h2>งานซ่อมค้าง (ความสำคัญสูงสุดก่อน)</h2>
        {topMaintenance.length === 0 ? (
          <p className="empty">ไม่มี</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ห้อง</th>
                <th>รายละเอียด</th>
                <th>ความสำคัญ</th>
                <th>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {topMaintenance.map((m) => (
                <tr key={m.id}>
                  <td>{m.room.roomNumber}</td>
                  <td>{m.description}</td>
                  <td>{m.priority}</td>
                  <td>{m.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
