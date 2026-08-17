import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { WalletIcon } from "../../icons";
import { createAccount, updateAccountStatus } from "./actions";

export default async function AccountsSettingsPage() {
  const { building } = await requireAccess("setting");
  const accounts = await prisma.account.findMany({ where: { buildingId: building.id }, orderBy: { id: "asc" } });

  return (
    <div>
      <h1 className="page-title">
        <WalletIcon size={22} /> บัญชีธนาคาร/เงินสด — {building.name}
      </h1>
      <p style={{ color: "var(--text-muted)", marginTop: -16, marginBottom: 20, fontSize: 14 }}>
        รายชื่อบัญชีที่ใช้เลือกตอนรับเงินโอน (มัดจำจอง, ชำระบิล ฯลฯ)
      </p>

      <div className="card">
        <h2>เพิ่มบัญชี</h2>
        <form action={createAccount} className="form-row">
          <div className="field">
            <label>ชื่อบัญชี</label>
            <input name="name" required placeholder="เช่น ธ.กสิกรไทย - เจ้าของหอพัก" />
          </div>
          <div className="field">
            <label>ประเภท</label>
            <select name="type" defaultValue="bank">
              <option value="bank">บัญชีธนาคาร</option>
              <option value="cash">เงินสด</option>
              <option value="other">อื่นๆ</option>
            </select>
          </div>
          <div className="field">
            <label>เลขบัญชี</label>
            <input name="accountNumber" />
          </div>
          <div>
            <button type="submit">เพิ่ม</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>รายชื่อบัญชี ({accounts.length})</h2>
        <table>
          <thead>
            <tr>
              <th>ชื่อบัญชี</th>
              <th>ประเภท</th>
              <th>เลขบัญชี</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>{a.name}</td>
                <td>{a.type === "bank" ? "ธนาคาร" : a.type === "cash" ? "เงินสด" : "อื่นๆ"}</td>
                <td>{a.accountNumber ?? "-"}</td>
                <td>
                  <span className={`badge ${a.status === "active" ? "success" : "neutral"}`}>
                    {a.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"}
                  </span>
                </td>
                <td>
                  <form action={updateAccountStatus}>
                    <input type="hidden" name="accountId" value={a.id} />
                    <input type="hidden" name="status" value={a.status === "active" ? "inactive" : "active"} />
                    <button type="submit" className="secondary">
                      {a.status === "active" ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {accounts.length === 0 && <p className="empty">ยังไม่มีบัญชี</p>}
      </div>
    </div>
  );
}
