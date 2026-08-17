import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { CalendarIcon, PlusIcon, TrashIcon } from "../../icons";
import { addClause, updateClause, deleteClause, moveClause } from "./actions";

export default async function ContractClausesPage() {
  const { building } = await requireAccess("setting");
  const clauses = await prisma.contractClauseTemplate.findMany({
    where: { buildingId: building.id },
    orderBy: { order: "asc" },
  });

  return (
    <div>
      <h1 className="page-title">
        <CalendarIcon size={22} /> ข้อสัญญา — {building.name}
      </h1>
      <p style={{ color: "var(--text-muted)", marginTop: -16, marginBottom: 20, fontSize: 14 }}>
        Template ข้อสัญญากลาง ใช้ร่วมกันทุกสัญญาในอาคารนี้ — ตอนสร้างสัญญาแต่ละฉบับเลือกได้แค่เปิด/ปิดว่าจะรวมข้อไหน
        แก้ไขข้อความทำได้ที่นี่เท่านั้น
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {clauses.map((c, i) => (
          <details key={c.id} className="card" style={{ marginBottom: 0 }}>
            <summary style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 10 }}>
              <span className="floor-badge">ข้อ {i + 1}</span>
              <strong style={{ flex: 1 }}>{c.title}</strong>
              {c.isDefaultIncluded && <span className="badge success">รวมเป็นค่าเริ่มต้น</span>}
            </summary>

            <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", gap: 8 }}>
                <form action={moveClause}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button type="submit" className="secondary" disabled={i === 0}>
                    ▲ เลื่อนขึ้น
                  </button>
                </form>
                <form action={moveClause}>
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button type="submit" className="secondary" disabled={i === clauses.length - 1}>
                    ▼ เลื่อนลง
                  </button>
                </form>
              </div>

              <form action={updateClause} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input type="hidden" name="id" value={c.id} />
                <div className="form-row">
                  <div className="field" style={{ flex: 1 }}>
                    <label>หัวข้อ (ไทย)</label>
                    <input name="title" defaultValue={c.title} required />
                  </div>
                  <div className="field" style={{ flex: 1 }}>
                    <label>หัวข้อ (อังกฤษ)</label>
                    <input name="titleEn" defaultValue={c.titleEn ?? ""} />
                  </div>
                </div>
                <div className="field">
                  <label>เนื้อหา (ไทย)</label>
                  <textarea name="body" defaultValue={c.body} required rows={4} />
                </div>
                <div className="field">
                  <label>เนื้อหา (อังกฤษ)</label>
                  <textarea name="bodyEn" defaultValue={c.bodyEn ?? ""} rows={4} />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
                  <input type="checkbox" name="isDefaultIncluded" defaultChecked={c.isDefaultIncluded} />
                  รวมข้อนี้เป็นค่าเริ่มต้นตอนสร้างสัญญาใหม่
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit">บันทึก</button>
                </div>
              </form>

              <form action={deleteClause}>
                <input type="hidden" name="id" value={c.id} />
                <button type="submit" className="plain-icon-btn" title="ลบข้อนี้">
                  <TrashIcon size={16} />
                </button>
              </form>
            </div>
          </details>
        ))}
      </div>

      <div className="card">
        <h2>
          <PlusIcon size={16} /> เพิ่มข้อสัญญาใหม่
        </h2>
        <form action={addClause} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="form-row">
            <div className="field" style={{ flex: 1 }}>
              <label>หัวข้อ (ไทย)</label>
              <input name="title" required />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>หัวข้อ (อังกฤษ)</label>
              <input name="titleEn" />
            </div>
          </div>
          <div className="field">
            <label>เนื้อหา (ไทย)</label>
            <textarea name="body" required rows={4} />
          </div>
          <div className="field">
            <label>เนื้อหา (อังกฤษ)</label>
            <textarea name="bodyEn" rows={4} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
            <input type="checkbox" name="isDefaultIncluded" defaultChecked /> รวมข้อนี้เป็นค่าเริ่มต้นตอนสร้างสัญญาใหม่
          </label>
          <div>
            <button type="submit">เพิ่มข้อสัญญา</button>
          </div>
        </form>
      </div>
    </div>
  );
}
