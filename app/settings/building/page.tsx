import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { BuildingIcon } from "../../icons";
import { updateBuildingSettings } from "./actions";

export default async function BuildingSettingsPage() {
  const { building } = await requireAccess("setting");
  const settings = await prisma.buildingSettings.findUnique({ where: { buildingId: building.id } });

  return (
    <div>
      <h1 className="page-title">
        <BuildingIcon size={22} /> ค่าตั้งอาคาร — {building.name}
      </h1>
      <p style={{ color: "var(--text-muted)", marginTop: -16, marginBottom: 20, fontSize: 14 }}>
        ค่าเริ่มต้นที่ห้องพักจะดึงไปใช้เมื่อตั้งค่าห้องเป็น &quot;ใช้ตามอาคาร&quot; (ไม่ override เฉพาะห้อง)
      </p>

      <div className="card">
        <form action={updateBuildingSettings} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="form-row">
            <div className="field">
              <label>โหมดค่าน้ำ</label>
              <select name="defaultWaterMode" defaultValue={settings?.defaultWaterMode ?? "flat"}>
                <option value="flat">เหมาจ่าย</option>
                <option value="metered">ตามมิเตอร์</option>
              </select>
            </div>
            <div className="field">
              <label>อัตราค่าน้ำ (บาท)</label>
              <input name="defaultWaterRate" type="number" step="0.01" defaultValue={settings?.defaultWaterRate ?? ""} />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label>โหมดค่าไฟ</label>
              <select name="defaultElectricMode" defaultValue={settings?.defaultElectricMode ?? "flat"}>
                <option value="flat">เหมาจ่าย</option>
                <option value="metered">ตามมิเตอร์</option>
              </select>
            </div>
            <div className="field">
              <label>อัตราค่าไฟ (บาท/หน่วย)</label>
              <input
                name="defaultElectricRate"
                type="number"
                step="0.01"
                defaultValue={settings?.defaultElectricRate ?? ""}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label>ค่าอินเทอร์เน็ต (บาท/เดือน)</label>
              <input
                name="defaultInternetFee"
                type="number"
                step="0.01"
                defaultValue={settings?.defaultInternetFee ?? ""}
              />
            </div>
            <div className="field">
              <label>ค่าส่วนกลาง (บาท/เดือน)</label>
              <input
                name="defaultCommonAreaFee"
                type="number"
                step="0.01"
                defaultValue={settings?.defaultCommonAreaFee ?? ""}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label>เงินมัดจำรายเดือน (บาท)</label>
              <input
                name="defaultMonthlyDeposit"
                type="number"
                step="0.01"
                defaultValue={settings?.defaultMonthlyDeposit ?? ""}
              />
            </div>
            <div className="field">
              <label>เงินมัดจำรายวัน (บาท)</label>
              <input
                name="defaultDailyDeposit"
                type="number"
                step="0.01"
                defaultValue={settings?.defaultDailyDeposit ?? ""}
              />
            </div>
            <div className="field">
              <label>พัสดุตกค้างเกิน (วัน)</label>
              <input
                name="parcelOverdueDays"
                type="number"
                defaultValue={settings?.parcelOverdueDays ?? 3}
              />
            </div>
          </div>

          <div>
            <button type="submit">บันทึก</button>
          </div>
        </form>
      </div>
    </div>
  );
}
