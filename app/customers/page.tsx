import { prisma } from "@/lib/prisma";
import { createCustomer } from "./actions";
import { addBlacklistEntry, removeBlacklistEntry } from "../blacklist/actions";
import { getCurrentUser, hasModuleAccess } from "@/lib/auth";
import { redirect } from "next/navigation";

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

export default async function CustomersPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasModuleAccess(user, "F")) {
    return <div className="card">ไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
  }

  const customers = await prisma.customer.findMany({ orderBy: { id: "desc" } });
  const blacklist = await prisma.blacklist.findMany({ where: { active: true } });
  const blacklistedPhones = new Set(blacklist.map((b) => b.phone));

  return (
    <div>
      <h1 className="page-title">ลูกค้า</h1>

      <div className="card">
        <h2>รายชื่อลูกค้า</h2>
        {customers.length === 0 ? (
          <p className="empty">ยังไม่มีลูกค้า</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ชื่อ</th>
                <th>เบอร์โทร</th>
                <th>เลขบัตร ปชช.</th>
                <th>ที่อยู่</th>
                <th>ผู้ติดต่อฉุกเฉิน</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id}>
                  <td>
                    {blacklistedPhones.has(c.phone) && "⚠️ "}
                    {c.name}
                  </td>
                  <td>{c.phone}</td>
                  <td>{c.idCardNo ?? "-"}</td>
                  <td>{c.address ?? "-"}</td>
                  <td>
                    {c.emergencyContactName
                      ? `${c.emergencyContactName} (${c.emergencyContactPhone ?? "-"})`
                      : "-"}
                  </td>
                  <td>
                    <a className="btn secondary" href={`/customers/${c.id}`}>
                      รายละเอียด
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form action={createCustomer} className="form-row" style={{ marginTop: 16 }}>
          <div className="field">
            <label>ชื่อ-นามสกุล</label>
            <input name="name" placeholder="ชื่อลูกค้า" required />
          </div>
          <div className="field">
            <label>เบอร์โทร</label>
            <input name="phone" placeholder="08xxxxxxxx" required />
          </div>
          <div className="field">
            <label>เลขบัตร ปชช.</label>
            <input name="idCardNo" />
          </div>
          <div className="field">
            <label>ที่อยู่</label>
            <input name="address" />
          </div>
          <div className="field">
            <label>ผู้ติดต่อฉุกเฉิน (ชื่อ)</label>
            <input name="emergencyContactName" />
          </div>
          <div className="field">
            <label>ผู้ติดต่อฉุกเฉิน (เบอร์)</label>
            <input name="emergencyContactPhone" />
          </div>
          <button type="submit">เพิ่มลูกค้า</button>
        </form>
      </div>

      <div className="card">
        <h2>Blacklist (บัญชีดำ)</h2>
        {blacklist.length === 0 ? (
          <p className="empty">ยังไม่มีรายการ</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>เบอร์โทร</th>
                <th>เหตุผล</th>
                <th>เพิ่มเมื่อ</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {blacklist.map((b) => (
                <tr key={b.id}>
                  <td>{b.phone}</td>
                  <td>{b.reason}</td>
                  <td>{formatDate(b.createdAt)}</td>
                  <td>
                    <form action={removeBlacklistEntry.bind(null, b.id)}>
                      <button type="submit" className="secondary">
                        ลบออกจากบัญชีดำ
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form action={addBlacklistEntry} className="form-row" style={{ marginTop: 16 }}>
          <div className="field">
            <label>เบอร์โทร</label>
            <input name="phone" placeholder="08xxxxxxxx" required />
          </div>
          <div className="field">
            <label>เหตุผล</label>
            <input name="reason" placeholder="เช่น เบี้ยวค่าเช่า" required />
          </div>
          <button type="submit">เพิ่มเข้าบัญชีดำ</button>
        </form>
        <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 12 }}>
          ระบบจะแสดงเครื่องหมาย ⚠️ เตือนหน้าชื่อลูกค้าที่เบอร์โทรตรงกับบัญชีดำด้านบน และตอนสร้างการจอง/สัญญา
        </p>
      </div>
    </div>
  );
}
