import { getAccessibleBuildings, getCurrentBuilding, requireUser } from "@/lib/auth";
import { BuildingIcon, PlusIcon } from "../icons";
import { enterBuilding, createBuilding } from "./actions";

export default async function SelectBuildingPage() {
  const user = await requireUser();
  const buildings = await getAccessibleBuildings(user);
  const current = await getCurrentBuilding(user);

  return (
    <div style={{ maxWidth: 620, margin: "40px auto" }}>
      <h1 className="page-title">
        <BuildingIcon size={22} /> เลือกอาคาร
      </h1>

      <div className="card">
        <div className="building-list">
          {buildings.map((b) => (
            <div key={b.id} className={`building-list-item${b.id === current?.id ? " current" : ""}`}>
              <div>
                <div style={{ fontWeight: 700 }}>{b.name}</div>
                {b.address && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{b.address}</div>}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {b.id === current?.id ? (
                  <span className="badge success">กำลังใช้งาน</span>
                ) : (
                  <form action={enterBuilding}>
                    <input type="hidden" name="buildingId" value={b.id} />
                    <button type="submit" className="secondary">
                      เข้าใช้งาน
                    </button>
                  </form>
                )}
                {user.role === "owner" && (
                  <a href={`/select-building/${b.id}/delete`} className="plain-icon-btn" title="ลบอาคาร">
                    ✕
                  </a>
                )}
              </div>
            </div>
          ))}
          {buildings.length === 0 && <p className="empty">ยังไม่มีอาคารที่เข้าถึงได้</p>}
        </div>
      </div>

      {user.role === "owner" && (
        <div className="card">
          <h2>
            <PlusIcon size={16} /> เพิ่มอาคารใหม่
          </h2>
          <form action={createBuilding} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="field">
              <label>ชื่ออาคาร</label>
              <input name="name" required />
            </div>
            <div className="field">
              <label>ที่อยู่</label>
              <input name="address" />
            </div>
            <div className="field">
              <label>จำนวนชั้น</label>
              <input name="floors" type="number" min={1} />
            </div>
            <button type="submit">เพิ่มอาคาร</button>
          </form>
        </div>
      )}
    </div>
  );
}
