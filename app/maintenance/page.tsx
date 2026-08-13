import { prisma } from "@/lib/prisma";
import { getDefaultBranch } from "../rooms/actions";
import { createMaintenanceRequest, updateMaintenanceStatus } from "./actions";
import { getCurrentUser, hasModuleAccess } from "@/lib/auth";
import { redirect } from "next/navigation";

const statusLabel: Record<string, string> = {
  new: "แจ้งใหม่",
  assigned: "มอบหมายแล้ว",
  in_progress: "กำลังซ่อม",
  done: "เสร็จแล้ว",
  cancelled: "ยกเลิก",
};

const statusClass: Record<string, string> = {
  new: "blocked",
  assigned: "unavailable",
  in_progress: "unavailable",
  done: "available",
  cancelled: "blocked",
};

function formatDate(d: Date) {
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

export default async function MaintenancePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasModuleAccess(user, "G")) {
    return <div className="card">ไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
  }

  const branch = await getDefaultBranch();
  const rooms = await prisma.room.findMany({
    where: { branchId: branch.id },
    orderBy: { roomNumber: "asc" },
  });
  const requests = await prisma.maintenanceRequest.findMany({
    where: { branchId: branch.id },
    include: { room: true },
    orderBy: [{ status: "asc" }, { priority: "asc" }, { id: "desc" }],
  });

  return (
    <div>
      <h1 className="page-title">แจ้งซ่อม</h1>

      <div className="card">
        <h2>รายการแจ้งซ่อม</h2>
        {requests.length === 0 ? (
          <p className="empty">ยังไม่มีรายการแจ้งซ่อม</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>ห้อง</th>
                <th>รายละเอียด</th>
                <th>หมวดหมู่</th>
                <th>ความสำคัญ</th>
                <th>ผู้รับผิดชอบ</th>
                <th>สถานะ</th>
                <th>วันที่แจ้ง</th>
                <th>ดำเนินการ</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => (
                <tr key={r.id}>
                  <td>{r.room.roomNumber}</td>
                  <td>{r.description}</td>
                  <td>{r.category ?? "-"}</td>
                  <td>{r.priority}</td>
                  <td>{r.assignedTo ?? "-"}</td>
                  <td>
                    <span className={`badge ${statusClass[r.status] ?? ""}`}>
                      {statusLabel[r.status] ?? r.status}
                    </span>
                  </td>
                  <td>{formatDate(r.createdAt)}</td>
                  <td>
                    {r.status === "new" && (
                      <form action={updateMaintenanceStatus} className="form-row">
                        <input type="hidden" name="requestId" value={r.id} />
                        <input type="hidden" name="status" value="assigned" />
                        <input name="assignedTo" placeholder="ผู้รับผิดชอบ" style={{ width: 110 }} required />
                        <button type="submit" className="secondary">
                          มอบหมาย
                        </button>
                      </form>
                    )}
                    {r.status === "assigned" && (
                      <form action={updateMaintenanceStatus}>
                        <input type="hidden" name="requestId" value={r.id} />
                        <input type="hidden" name="status" value="in_progress" />
                        <button type="submit" className="secondary">
                          เริ่มซ่อม
                        </button>
                      </form>
                    )}
                    {r.status === "in_progress" && (
                      <form action={updateMaintenanceStatus} className="form-row">
                        <input type="hidden" name="requestId" value={r.id} />
                        <input type="hidden" name="status" value="done" />
                        <input name="cost" type="number" step="0.01" placeholder="ค่าใช้จ่าย" style={{ width: 100 }} />
                        <button type="submit" className="secondary">
                          เสร็จสิ้น
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <form action={createMaintenanceRequest} className="form-row" style={{ marginTop: 16 }}>
          <div className="field">
            <label>ห้อง</label>
            <select name="roomId" required>
              <option value="">เลือกห้อง</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.roomNumber}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ minWidth: 220 }}>
            <label>รายละเอียด</label>
            <input name="description" placeholder="เช่น แอร์ไม่เย็น" required />
          </div>
          <div className="field">
            <label>หมวดหมู่</label>
            <input name="category" placeholder="เช่น ไฟฟ้า, ประปา, ล้างแอร์" />
          </div>
          <div className="field">
            <label>ความสำคัญ (1 สูงสุด - 5 ต่ำสุด)</label>
            <select name="priority" defaultValue={3}>
              {[1, 2, 3, 4, 5].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>
          <button type="submit">แจ้งซ่อม</button>
        </form>
      </div>
    </div>
  );
}
