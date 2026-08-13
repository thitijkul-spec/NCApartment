import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createStaffUser, updateUser } from "./actions";

const MODULE_LABELS: Record<string, string> = {
  A: "ห้องพัก/จอง/สัญญา",
  B: "บิล",
  C: "มิเตอร์น้ำไฟ",
  D: "รายงาน",
  F: "ลูกค้า/Blacklist",
  G: "แจ้งซ่อม",
  H: "แม่บ้าน",
  M: "Cross Check รายวัน",
  L: "รายจ่าย/บัญชี",
};
const MODULE_CODES = Object.keys(MODULE_LABELS);

export default async function UsersPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (currentUser.role !== "owner" && !currentUser.canManageUsers) {
    return (
      <div>
        <h1 className="page-title">ผู้ใช้งาน</h1>
        <div className="card">
          <p>คุณไม่มีสิทธิ์เข้าถึงหน้านี้ — ต้องเป็นเจ้าของหรือได้รับสิทธิ์จัดการผู้ใช้งาน</p>
        </div>
      </div>
    );
  }

  const users = await prisma.user.findMany({ orderBy: { id: "asc" } });

  return (
    <div>
      <h1 className="page-title">ผู้ใช้งานและสิทธิ์</h1>

      <div className="card">
        <h2>รายชื่อผู้ใช้งาน</h2>
        <table>
          <thead>
            <tr>
              <th>ชื่อ</th>
              <th>Username</th>
              <th>บทบาท</th>
              <th>สิทธิ์เข้าถึงโมดูล</th>
              <th>จัดการผู้ใช้</th>
              <th>สถานะ</th>
              <th>บันทึก</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.username}</td>
                <td>{u.role === "owner" ? "เจ้าของ" : "พนักงาน"}</td>
                <td colSpan={u.role === "owner" ? 1 : undefined}>
                  {u.role === "owner" ? (
                    "ทุกอย่าง"
                  ) : (
                    <form action={updateUser} id={`form-${u.id}`}>
                      <input type="hidden" name="userId" value={u.id} />
                      <div className="form-row">
                        {MODULE_CODES.map((code) => (
                          <label
                            key={code}
                            style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}
                          >
                            <input
                              type="checkbox"
                              name={`perm_${code}`}
                              defaultChecked={u.permissions.split(",").includes(code)}
                            />
                            {MODULE_LABELS[code]}
                          </label>
                        ))}
                      </div>
                    </form>
                  )}
                </td>
                <td>
                  {u.role !== "owner" && (
                    <input
                      type="checkbox"
                      name="canManageUsers"
                      form={`form-${u.id}`}
                      defaultChecked={u.canManageUsers}
                    />
                  )}
                </td>
                <td>
                  {u.role !== "owner" && (
                    <label style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <input
                        type="checkbox"
                        name="active"
                        form={`form-${u.id}`}
                        defaultChecked={u.active}
                      />
                      ใช้งานได้
                    </label>
                  )}
                </td>
                <td>
                  {u.role !== "owner" && (
                    <button type="submit" form={`form-${u.id}`} className="secondary">
                      บันทึก
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>เพิ่มพนักงานใหม่</h2>
        <form action={createStaffUser} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-row">
            <div className="field">
              <label>ชื่อ-นามสกุล</label>
              <input name="name" required />
            </div>
            <div className="field">
              <label>Username</label>
              <input name="username" required />
            </div>
            <div className="field">
              <label>รหัสผ่าน</label>
              <input name="password" type="password" required minLength={4} />
            </div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" name="canManageUsers" />
            ให้สิทธิ์จัดการผู้ใช้งาน
          </label>
          <div>
            <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 6 }}>
              สิทธิ์เข้าถึงโมดูล (ค่าเริ่มต้น: เลือกทั้งหมด)
            </div>
            <div className="form-row">
              {MODULE_CODES.map((code) => (
                <label key={code} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13 }}>
                  <input type="checkbox" name={`perm_${code}`} defaultChecked />
                  {MODULE_LABELS[code]}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" style={{ width: 200 }}>
            เพิ่มพนักงาน
          </button>
        </form>
      </div>
    </div>
  );
}
