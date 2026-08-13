import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { addCustomerNote } from "../actions";
import { getCurrentUser, hasModuleAccess } from "@/lib/auth";
import { getDefaultBranch } from "../../rooms/actions";
import { createContract, setContractStatus } from "../../contracts/actions";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

const contractStatusLabel: Record<string, string> = {
  active: "กำลังเช่า",
  ended: "สิ้นสุดสัญญา",
  terminated: "ยกเลิกก่อนกำหนด",
};

const contractStatusClass: Record<string, string> = {
  active: "available",
  ended: "unavailable",
  terminated: "blocked",
};

const contractNextActions: Record<string, { status: string; label: string }[]> = {
  active: [
    { status: "ended", label: "สิ้นสุดสัญญา" },
    { status: "terminated", label: "ยกเลิกสัญญา" },
  ],
  ended: [{ status: "active", label: "เปิดใช้งานอีกครั้ง" }],
  terminated: [{ status: "active", label: "เปิดใช้งานอีกครั้ง" }],
};

export default async function CustomerDetailPage({ params }: { params: { id: string } }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasModuleAccess(user, "F")) {
    return <div className="card">ไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
  }

  const customerId = Number(params.id);
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: { notes: { orderBy: { createdAt: "desc" } } },
  });
  if (!customer) notFound();

  const isBlacklisted = await prisma.blacklist.findFirst({
    where: { phone: customer.phone, active: true },
  });

  const branch = await getDefaultBranch();
  const rooms = await prisma.room.findMany({
    where: { branchId: branch.id },
    include: { roomType: true },
    orderBy: { roomNumber: "asc" },
  });
  const contracts = await prisma.contract.findMany({
    where: { customerId },
    include: { room: true },
    orderBy: { id: "desc" },
  });

  return (
    <div>
      <h1 className="page-title">
        <a href="/customers" style={{ color: "var(--muted)", fontSize: 15, marginRight: 8 }}>
          ← กลับ
        </a>
        {customer.name}
      </h1>

      {isBlacklisted && (
        <div className="card" style={{ background: "var(--danger-bg)", color: "var(--danger)" }}>
          ⚠️ ลูกค้ารายนี้อยู่ในบัญชีดำ — เหตุผล: {isBlacklisted.reason}
        </div>
      )}

      <div className="card">
        <h2>ข้อมูลลูกค้า</h2>
        <table>
          <tbody>
            <tr>
              <th>เบอร์โทร</th>
              <td>{customer.phone}</td>
              <th>เลขบัตร ปชช.</th>
              <td>{customer.idCardNo ?? "-"}</td>
            </tr>
            <tr>
              <th>ที่อยู่</th>
              <td>{customer.address ?? "-"}</td>
              <th>ผู้ติดต่อฉุกเฉิน</th>
              <td>
                {customer.emergencyContactName
                  ? `${customer.emergencyContactName} (${customer.emergencyContactPhone ?? "-"})`
                  : "-"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>สัญญาเช่า</h2>
        {contracts.length === 0 ? (
          <p className="empty">ยังไม่มีสัญญา</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ห้อง</th>
                <th>เริ่มสัญญา</th>
                <th>สิ้นสุดสัญญา</th>
                <th>ค่าเช่า/เดือน</th>
                <th>เงินมัดจำ</th>
                <th>สถานะ</th>
                <th>ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id}>
                  <td>{c.room.roomNumber}</td>
                  <td>{formatDate(c.startDate)}</td>
                  <td>{formatDate(c.endDate)}</td>
                  <td>{c.monthlyRate.toLocaleString()}</td>
                  <td>{c.depositAmount.toLocaleString()}</td>
                  <td>
                    <span className={`badge ${contractStatusClass[c.status] ?? ""}`}>
                      {contractStatusLabel[c.status] ?? c.status}
                    </span>
                  </td>
                  <td>
                    <div className="status-buttons">
                      {(contractNextActions[c.status] ?? []).map((a) => (
                        <form key={a.status} action={setContractStatus.bind(null, c.id, a.status)}>
                          <button type="submit" className="secondary">
                            {a.label}
                          </button>
                        </form>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form action={createContract} className="form-row" style={{ marginTop: 16 }}>
          <input type="hidden" name="customerId" value={customer.id} />
          <div className="field">
            <label>ห้อง</label>
            <select name="roomId" required disabled={rooms.length === 0}>
              <option value="">เลือกห้อง</option>
              {rooms.map((r) => {
                const effMonthly = r.priceMonthly ?? r.roomType.priceMonthly;
                return (
                  <option key={r.id} value={r.id}>
                    {r.roomNumber} — {r.roomType.name}
                    {effMonthly ? ` (${effMonthly}/เดือน)` : ""}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="field">
            <label>วันเริ่มสัญญา</label>
            <input name="startDate" type="date" required />
          </div>
          <div className="field">
            <label>วันสิ้นสุดสัญญา</label>
            <input name="endDate" type="date" required />
          </div>
          <div className="field">
            <label>ค่าเช่า/เดือน (บาท)</label>
            <input name="monthlyRate" type="number" step="0.01" required />
          </div>
          <div className="field">
            <label>เงินมัดจำ (บาท)</label>
            <input name="depositAmount" type="number" step="0.01" defaultValue={0} />
          </div>
          <button type="submit" disabled={rooms.length === 0}>
            สร้างสัญญา
          </button>
        </form>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 12 }}>
          หมายเหตุ: เวอร์ชันนี้ยังไม่มีระบบเซ็นสัญญาผ่าน LINE หรือพิมพ์ PDF — จะเพิ่มทีหลัง
        </p>
      </div>

      <div className="card">
        <h2>บันทึกเพิ่มเติม</h2>
        {customer.notes.length === 0 ? (
          <p className="empty">ยังไม่มีบันทึก</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>วันที่</th>
                <th>บันทึก</th>
              </tr>
            </thead>
            <tbody>
              {customer.notes.map((n) => (
                <tr key={n.id}>
                  <td>{formatDate(n.createdAt)}</td>
                  <td>{n.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form action={addCustomerNote} className="form-row" style={{ marginTop: 16 }}>
          <input type="hidden" name="customerId" value={customer.id} />
          <div className="field" style={{ minWidth: 300 }}>
            <label>บันทึกใหม่</label>
            <input name="note" required />
          </div>
          <button type="submit">เพิ่มบันทึก</button>
        </form>
      </div>
    </div>
  );
}
