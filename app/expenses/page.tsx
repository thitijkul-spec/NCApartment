import { prisma } from "@/lib/prisma";
import { getDefaultBranch } from "../rooms/actions";
import { createExpense } from "./actions";
import { getCurrentUser, hasModuleAccess } from "@/lib/auth";
import { redirect } from "next/navigation";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

export default async function ExpensesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasModuleAccess(user, "L")) {
    return <div className="card">ไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
  }

  const branch = await getDefaultBranch();

  const expenses = await prisma.expense.findMany({
    where: { branchId: branch.id },
    orderBy: { expenseDate: "desc" },
  });
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  const payments = await prisma.payment.findMany({ where: { bill: { branchId: branch.id } } });
  const totalRevenue = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <div>
      <h1 className="page-title">รายจ่าย / กำไรขาดทุน</h1>

      <div className="card">
        <h2>สรุปกำไรขาดทุน (ทั้งหมด)</h2>
        <div className="form-row">
          <div className="field">
            <label>รายได้รวม (เงินที่รับมาจริง)</label>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--success)" }}>
              {totalRevenue.toLocaleString()}
            </div>
          </div>
          <div className="field">
            <label>ค่าใช้จ่ายรวม</label>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--danger)" }}>
              {totalExpenses.toLocaleString()}
            </div>
          </div>
          <div className="field">
            <label>กำไรสุทธิ</label>
            <div style={{ fontSize: 22, fontWeight: 700, color: "var(--navy)" }}>
              {(totalRevenue - totalExpenses).toLocaleString()}
            </div>
          </div>
        </div>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>
          หมายเหตุ: เป็นบัญชีแบบเงินสดอย่างง่าย (รายรับ-รายจ่าย) ไม่ใช่บัญชีคู่ (double-entry) แบบมาตรฐานบัญชี
          เหมาะสำหรับติดตามกระแสเงินสดเบื้องต้น ควรใช้คู่กับผู้ตรวจสอบบัญชีก่อนยื่นงบทางการ
        </p>
      </div>

      <div className="card">
        <h2>รายการค่าใช้จ่าย</h2>
        {expenses.length === 0 ? (
          <p className="empty">ยังไม่มีรายจ่าย</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>วันที่</th>
                <th>หมวดหมู่</th>
                <th>รายละเอียด</th>
                <th>จำนวนเงิน</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((e) => (
                <tr key={e.id}>
                  <td>{formatDate(e.expenseDate)}</td>
                  <td>{e.category}</td>
                  <td>{e.description ?? "-"}</td>
                  <td>{e.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form action={createExpense} className="form-row" style={{ marginTop: 16 }}>
          <div className="field">
            <label>วันที่</label>
            <input name="expenseDate" type="date" required />
          </div>
          <div className="field">
            <label>หมวดหมู่</label>
            <input name="category" placeholder="เช่น ซ่อมบำรุง, เงินเดือน" required />
          </div>
          <div className="field" style={{ minWidth: 220 }}>
            <label>รายละเอียด</label>
            <input name="description" />
          </div>
          <div className="field">
            <label>จำนวนเงิน (บาท)</label>
            <input name="amount" type="number" step="0.01" required />
          </div>
          <button type="submit">เพิ่มรายจ่าย</button>
        </form>
      </div>
    </div>
  );
}
