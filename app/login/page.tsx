import { prisma } from "@/lib/prisma";
import { bootstrapOwner, login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const userCount = await prisma.user.count();

  if (userCount === 0) {
    return (
      <div style={{ maxWidth: 420, margin: "60px auto" }}>
        <h1 className="page-title">ตั้งค่าครั้งแรก</h1>
        <div className="card">
          <h2>สร้างบัญชีเจ้าของ (Owner)</h2>
          <p style={{ color: "var(--muted)", fontSize: 14 }}>
            ยังไม่มีผู้ใช้งานในระบบ กรอกข้อมูลเพื่อสร้างบัญชีเจ้าของคนแรก (มีได้คนเดียวเท่านั้น)
          </p>
          <form action={bootstrapOwner} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field">
              <label>ชื่อ-นามสกุล</label>
              <input name="name" required />
            </div>
            <div className="field">
              <label>ชื่อผู้ใช้ (username)</label>
              <input name="username" required />
            </div>
            <div className="field">
              <label>รหัสผ่าน (อย่างน้อย 4 ตัวอักษร)</label>
              <input name="password" type="password" required minLength={4} />
            </div>
            <div className="field">
              <label>ชื่ออาคาร/สาขาแรก</label>
              <input name="buildingName" required />
            </div>
            <button type="submit">สร้างบัญชีและเข้าสู่ระบบ</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 420, margin: "60px auto" }}>
      <h1 className="page-title">เข้าสู่ระบบ</h1>
      <div className="card">
        {searchParams.error && (
          <p style={{ color: "var(--danger)" }}>ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง</p>
        )}
        <form action={login} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="field">
            <label>ชื่อผู้ใช้</label>
            <input name="username" required />
          </div>
          <div className="field">
            <label>รหัสผ่าน</label>
            <input name="password" type="password" required />
          </div>
          <button type="submit">เข้าสู่ระบบ</button>
        </form>
      </div>
    </div>
  );
}
