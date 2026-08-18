"use client";

import { useState, useTransition } from "react";
import type { Technician, RepairCategory, SharedEquipment } from "./types";
import { createCategory, deleteCategory, createTechnician, toggleTechnicianActive, createSharedEquipment, deleteSharedEquipment } from "./actions";
import { XIcon, TrashIcon } from "../icons";

const TABS = ["ประเภทงานซ่อม", "ช่าง", "อุปกรณ์ส่วนกลาง"] as const;

export default function RepairSettingsModal({
  categories,
  technicians,
  equipment,
  onClose,
}: {
  categories: RepairCategory[];
  technicians: Technician[];
  equipment: SharedEquipment[];
  onClose: () => void;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("ประเภทงานซ่อม");
  const [, startTransition] = useTransition();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>ตั้งค่าแจ้งซ่อม</h2>
          <button className="modal-close" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        <div className="modal-body">
          <div className="modal-tabs">
            {TABS.map((t) => (
              <button key={t} className={`modal-tab${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>

          {tab === "ประเภทงานซ่อม" && (
            <div>
              {categories.map((c) => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <span>{c.name}</span>
                  <form action={(fd) => startTransition(async () => { await deleteCategory(fd); })}>
                    <input type="hidden" name="categoryId" value={c.id} />
                    <button type="submit" className="plain-icon-btn">
                      <TrashIcon size={16} />
                    </button>
                  </form>
                </div>
              ))}
              <form action={(fd) => startTransition(() => createCategory(fd))} className="form-row" style={{ marginTop: 12 }}>
                <input name="name" placeholder="ชื่อประเภทใหม่" required />
                <button type="submit" className="secondary">
                  เพิ่ม
                </button>
              </form>
            </div>
          )}

          {tab === "ช่าง" && (
            <div>
              {technicians.map((t) => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <span>
                    {t.name} {t.phone && `(${t.phone})`}
                  </span>
                  <form
                    action={(fd) => {
                      fd.set("active", t.active ? "" : "on");
                      startTransition(async () => { await toggleTechnicianActive(fd); });
                    }}
                  >
                    <input type="hidden" name="technicianId" value={t.id} />
                    <button type="submit" className="secondary">
                      {t.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                    </button>
                  </form>
                </div>
              ))}
              <form action={(fd) => startTransition(() => createTechnician(fd))} className="form-row" style={{ marginTop: 12 }}>
                <input name="name" placeholder="ชื่อช่าง" required />
                <input name="phone" placeholder="เบอร์โทร" />
                <button type="submit" className="secondary">
                  เพิ่ม
                </button>
              </form>
            </div>
          )}

          {tab === "อุปกรณ์ส่วนกลาง" && (
            <div>
              {equipment.map((e) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                  <span>
                    {e.name} ({e.type === "washer" ? "เครื่องซักผ้า" : e.type === "dryer" ? "เครื่องอบผ้า" : "ตู้กดน้ำ"})
                  </span>
                  <form action={(fd) => startTransition(async () => { await deleteSharedEquipment(fd); })}>
                    <input type="hidden" name="equipmentId" value={e.id} />
                    <button type="submit" className="plain-icon-btn">
                      <TrashIcon size={16} />
                    </button>
                  </form>
                </div>
              ))}
              <form action={(fd) => startTransition(() => createSharedEquipment(fd))} className="form-row" style={{ marginTop: 12 }}>
                <input name="name" placeholder="ชื่ออุปกรณ์" required />
                <select name="type" defaultValue="washer">
                  <option value="washer">เครื่องซักผ้า</option>
                  <option value="dryer">เครื่องอบผ้า</option>
                  <option value="water_dispenser">ตู้กดน้ำ</option>
                </select>
                <button type="submit" className="secondary">
                  เพิ่ม
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
