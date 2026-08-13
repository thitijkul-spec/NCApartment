import { prisma } from "@/lib/prisma";
import { getDefaultBranch } from "../rooms/actions";
import {
  confirmAndIssueBills,
  revertBatch,
  submitMeterBatch,
  updateDraftReading,
} from "./actions";
import { getCurrentUser, hasModuleAccess } from "@/lib/auth";
import { redirect } from "next/navigation";

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function MetersPage({
  searchParams,
}: {
  searchParams: { month?: string };
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasModuleAccess(user, "C")) {
    return <div className="card">ไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
  }

  const branch = await getDefaultBranch();
  const month = searchParams.month || currentMonth();

  const rooms = await prisma.room.findMany({
    where: { branchId: branch.id, waterElectricMode: "metered", active: true },
    include: { roomType: true },
    orderBy: { roomNumber: "asc" },
  });

  const previousReadingsMap = new Map<string, number>();
  for (const room of rooms) {
    for (const meterType of ["water", "electric"]) {
      const prev = await prisma.meterReading.findFirst({
        where: {
          roomId: room.id,
          meterType,
          status: "confirmed",
          billingMonth: { lt: month },
        },
        orderBy: { billingMonth: "desc" },
      });
      previousReadingsMap.set(`${room.id}_${meterType}`, prev?.currentReading ?? 0);
    }
  }

  const readingsThisMonth = await prisma.meterReading.findMany({
    where: { billingMonth: month },
    include: { room: true },
    orderBy: { roomId: "asc" },
  });

  const hasDraft = readingsThisMonth.some((r) => r.status === "draft");
  const hasConfirmed = readingsThisMonth.some((r) => r.status === "confirmed");

  return (
    <div>
      <h1 className="page-title">มิเตอร์น้ำ-ไฟ</h1>

      <div className="card">
        <h2>เดือนที่จด: {month}</h2>
        <form method="get" className="form-row" style={{ marginBottom: 16 }}>
          <div className="field">
            <label>เลือกเดือน</label>
            <input name="month" type="month" defaultValue={month} />
          </div>
          <button type="submit" className="secondary">
            เปลี่ยนเดือน
          </button>
        </form>

        {rooms.length === 0 ? (
          <p className="empty">ไม่มีห้องที่ใช้ระบบมิเตอร์ (ทุกห้องตั้งเป็นเหมาจ่าย)</p>
        ) : (
          <form action={submitMeterBatch}>
            <input type="hidden" name="billingMonth" value={month} />
            <div className="form-row" style={{ marginBottom: 16 }}>
              <div className="field">
                <label>ค่าน้ำ/หน่วย (บาท)</label>
                <input name="waterRate" type="number" step="0.01" defaultValue={branch.defaultWaterRate ?? 18} />
              </div>
              <div className="field">
                <label>ค่าไฟ/หน่วย (บาท)</label>
                <input
                  name="electricRate"
                  type="number"
                  step="0.01"
                  defaultValue={branch.defaultElectricRate ?? 8}
                />
              </div>
            </div>
            <table>
              <thead>
                <tr>
                  <th>ห้อง</th>
                  <th>น้ำ (เดือนก่อน)</th>
                  <th>น้ำ (เดือนนี้)</th>
                  <th>ไฟ (เดือนก่อน)</th>
                  <th>ไฟ (เดือนนี้)</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.id}>
                    <td>
                      {room.roomNumber} ({room.roomType.name})
                    </td>
                    <td>{previousReadingsMap.get(`${room.id}_water`)}</td>
                    <td>
                      <input
                        name={`water_${room.id}`}
                        type="number"
                        step="0.01"
                        style={{ width: 100 }}
                      />
                    </td>
                    <td>{previousReadingsMap.get(`${room.id}_electric`)}</td>
                    <td>
                      <input
                        name={`electric_${room.id}`}
                        type="number"
                        step="0.01"
                        style={{ width: 100 }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button type="submit" style={{ marginTop: 16 }}>
              บันทึกทั้งหมด
            </button>
          </form>
        )}
      </div>

      {readingsThisMonth.length > 0 && (
        <div className="card">
          <h2>ตรวจสอบก่อนออกบิล — {month}</h2>
          <table>
            <thead>
              <tr>
                <th>ห้อง</th>
                <th>ประเภท</th>
                <th>เดือนก่อน</th>
                <th>เดือนนี้</th>
                <th>หน่วยที่ใช้</th>
                <th>จำนวนเงิน</th>
                <th>สถานะ</th>
                <th>แก้ไข</th>
              </tr>
            </thead>
            <tbody>
              {readingsThisMonth.map((r) => (
                <tr key={r.id} style={r.flaggedAbnormal ? { background: "var(--warning-bg)" } : {}}>
                  <td>{r.room.roomNumber}</td>
                  <td>{r.meterType === "water" ? "น้ำ" : "ไฟ"}</td>
                  <td>{r.previousReading}</td>
                  <td>{r.currentReading}</td>
                  <td>
                    {r.unitUsed} {r.flaggedAbnormal ? "⚠️ ผิดปกติ" : ""}
                  </td>
                  <td>{r.amount.toLocaleString()}</td>
                  <td>
                    <span className={`badge ${r.status === "confirmed" ? "available" : "unavailable"}`}>
                      {r.status === "draft" ? "ร่าง" : r.status === "confirmed" ? "ยืนยันแล้ว" : "แก้ไขได้"}
                    </span>
                  </td>
                  <td>
                    {(r.status === "draft" || r.status === "editable") && (
                      <form action={updateDraftReading} className="form-row">
                        <input type="hidden" name="readingId" value={r.id} />
                        <input
                          name="currentReading"
                          type="number"
                          step="0.01"
                          defaultValue={r.currentReading}
                          style={{ width: 90 }}
                        />
                        <button type="submit" className="secondary">
                          บันทึก
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="status-buttons" style={{ marginTop: 16 }}>
            {hasDraft && (
              <form action={confirmAndIssueBills.bind(null, month)}>
                <button type="submit">ยืนยันและออกบิลรอบนี้</button>
              </form>
            )}
            {hasConfirmed && (
              <form action={revertBatch.bind(null, month)}>
                <button type="submit" className="secondary">
                  ดึงบิลกลับ (แก้ไขมิเตอร์)
                </button>
              </form>
            )}
          </div>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 8 }}>
            "ดึงบิลกลับ" จะลบเฉพาะบิลที่ยังไม่มีการชำระเงิน ห้องที่ชำระแล้วจะถูกข้าม
          </p>
        </div>
      )}
    </div>
  );
}
