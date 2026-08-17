import { prisma } from "@/lib/prisma";
import { requireAccess } from "@/lib/auth";
import { WalletIcon } from "../../icons";
import { updatePayeeSettings } from "./actions";

export default async function PayeeSettingsPage() {
  const { building } = await requireAccess("setting");
  const payee = await prisma.buildingPayeeSettings.findUnique({ where: { buildingId: building.id } });

  return (
    <div>
      <h1 className="page-title">
        <WalletIcon size={22} /> ข้อมูลผู้รับเงิน — {building.name}
      </h1>
      <p style={{ color: "var(--text-muted)", marginTop: -16, marginBottom: 20, fontSize: 14 }}>
        ใช้พิมพ์บนสัญญาเช่าและใบเสร็จ/ใบกำกับภาษี (snapshot ณ วันที่สร้างเอกสาร ไม่เปลี่ยนย้อนหลัง)
      </p>

      <div className="card">
        <form
          action={updatePayeeSettings}
          encType="multipart/form-data"
          style={{ display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div className="field">
            <label>ข้อความหัวเอกสาร (header)</label>
            <input name="headerTextTemplate" defaultValue={payee?.headerTextTemplate ?? ""} />
          </div>
          <div className="form-row">
            <div className="field">
              <label>ชื่อผู้รับเงิน/เจ้าของกิจการ</label>
              <input name="payeeName" defaultValue={payee?.payeeName ?? ""} />
            </div>
            <div className="field">
              <label>เลขบัตรประชาชน/เลขผู้เสียภาษี</label>
              <input name="payeeIdCardNo" defaultValue={payee?.payeeIdCardNo ?? ""} />
            </div>
            <div className="field">
              <label>เบอร์โทร</label>
              <input name="payeePhone" defaultValue={payee?.payeePhone ?? ""} />
            </div>
          </div>
          <div className="field">
            <label>ที่อยู่</label>
            <input name="payeeAddress" defaultValue={payee?.payeeAddress ?? ""} />
          </div>

          <div className="form-row">
            <div className="field">
              <label>โลโก้ (JPG/PNG/WEBP, ≤10MB)</label>
              <input name="logo" type="file" accept="image/*" />
              {payee?.logoUrl && (
                <img src={payee.logoUrl} alt="logo" style={{ height: 48, marginTop: 8, borderRadius: 8 }} />
              )}
            </div>
            <div className="field">
              <label>ลายเซ็น (JPG/PNG/WEBP, ≤10MB)</label>
              <input name="signature" type="file" accept="image/*" />
              {payee?.signatureImageUrl && (
                <img
                  src={payee.signatureImageUrl}
                  alt="signature"
                  style={{ height: 48, marginTop: 8, borderRadius: 8 }}
                />
              )}
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
