import { prisma } from "@/lib/prisma";
import { requireUser, MODULES } from "@/lib/auth";
import { PersonIcon } from "../../icons";
import { createStaffUser, updateStaffUser, resetStaffPassword } from "./actions";

export default async function UsersSettingsPage() {
  const owner = await requireUser();

  if (owner.role !== "owner") {
    return <div className="card">ไม่มีสิทธิ์เข้าถึงหน้านี้ — เฉพาะเจ้าของระบบเท่านั้น</div>;
  }

  const [users, buildings] = await Promise.all([
    prisma.user.findMany({
      where: { role: "staff" },
      include: { buildingAccess: { include: { building: true } } },
      orderBy: { id: "asc" },
    }),
    prisma.building.findMany({ orderBy: { id: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="page-title">
        <PersonIcon size={22} /> ผู้ใช้งาน/สิทธิ์
      </h1>

      <div className="card">
        <h2>เพิ่มพนักงานใหม่</h2>
        <form action={createStaffUser} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-row">
            <div className="field">
              <label>ชื่อ-นามสกุล</label>
              <input name="name" required />
            </div>
            <div className="field">
              <label>ชื่อผู้ใช้</label>
              <input name="username" required />
            </div>
            <div className="field">
              <label>รหัสผ่าน</label>
              <input name="password" type="password" required minLength={4} />
            </div>
          </div>

          <PermissionAndBuildingFields buildings={buildings} />

          <div>
            <button type="submit">เพิ่มพนักงาน</button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>รายชื่อพนักงาน ({users.length})</h2>
        {users.length === 0 && <p className="empty">ยังไม่มีพนักงานในระบบ</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {users.map((u) => (
            <div key={u.id} style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div>
                  <strong>{u.name}</strong> <span style={{ color: "var(--text-muted)" }}>@{u.username}</span>
                </div>
                <span className={`badge ${u.active ? "success" : "danger"}`}>
                  {u.active ? "ใช้งานอยู่" : "ปิดใช้งาน"}
                </span>
              </div>

              <form action={updateStaffUser} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input type="hidden" name="userId" value={u.id} />
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                  <input type="checkbox" name="active" defaultChecked={u.active} /> เปิดใช้งานบัญชีนี้
                </label>
                <PermissionAndBuildingFields
                  buildings={buildings}
                  selectedPermissions={u.permissions.split(",")}
                  selectedBuildingIds={u.buildingAccess.map((a) => a.buildingId)}
                />
                <div>
                  <button type="submit" className="secondary">
                    บันทึกการเปลี่ยนแปลง
                  </button>
                </div>
              </form>

              <form
                action={resetStaffPassword}
                style={{ display: "flex", gap: 8, alignItems: "flex-end", marginTop: 12 }}
              >
                <input type="hidden" name="userId" value={u.id} />
                <div className="field" style={{ minWidth: 200 }}>
                  <label>ตั้งรหัสผ่านใหม่</label>
                  <input name="password" type="password" minLength={4} placeholder="อย่างน้อย 4 ตัวอักษร" />
                </div>
                <button type="submit" className="secondary">
                  รีเซ็ตรหัสผ่าน
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PermissionAndBuildingFields({
  buildings,
  selectedPermissions = [],
  selectedBuildingIds = [],
}: {
  buildings: { id: number; name: string }[];
  selectedPermissions?: string[];
  selectedBuildingIds?: number[];
}) {
  return (
    <>
      <div>
        <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
          สิทธิ์การเข้าถึงเมนู
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          {MODULES.map((m) => (
            <label key={m.code} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
              <input
                type="checkbox"
                name={`perm_${m.code}`}
                defaultChecked={selectedPermissions.includes(m.code)}
              />
              {m.label}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label style={{ fontSize: 13, color: "var(--text-muted)", display: "block", marginBottom: 6 }}>
          อาคารที่เข้าถึงได้
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          {buildings.map((b) => (
            <label key={b.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14 }}>
              <input
                type="checkbox"
                name="buildingIds"
                value={b.id}
                defaultChecked={selectedBuildingIds.includes(b.id)}
              />
              {b.name}
            </label>
          ))}
          {buildings.length === 0 && <span className="empty">ยังไม่มีอาคาร</span>}
        </div>
      </div>
    </>
  );
}
