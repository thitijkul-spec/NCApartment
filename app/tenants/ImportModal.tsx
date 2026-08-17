"use client";

import { useState, useTransition } from "react";
import { importTenantsCsv } from "./actions";
import { XIcon } from "../icons";

export default function ImportModal({ onClose, onSaved }: { onClose: () => void; onSaved: (msg: string) => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ imported: number; skipped: string[] } | null>(null);

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await importTenantsCsv(formData);
      if (res?.error) setError(res.error);
      else if (res?.success) {
        setResult({ imported: res.imported, skipped: res.skipped });
        onSaved(`นำเข้าสำเร็จ ${res.imported} รายการ`);
      }
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>นำเข้าผู้เช่าจากไฟล์ CSV</h2>
          <button className="modal-close" onClick={onClose}>
            <XIcon size={18} />
          </button>
        </div>
        <div className="modal-body">
          {error && <div className="form-error">{error}</div>}
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            คอลัมน์ (คั่นด้วย comma, แถวแรกเป็นหัวตาราง): ชื่อ, เบอร์โทร, เลขบัตร, ประเภท(monthly/daily), เลขห้อง, วันเข้าพัก(YYYY-MM-DD), เงินมัดจำ
            <br />
            ถ้าเลขห้องระบุห้องที่มีผู้เช่าอยู่แล้ว แถวนั้นจะถูกข้าม ส่วนแถวอื่นนำเข้าตามปกติ
          </p>
          <form action={handleSubmit}>
            <input name="file" type="file" accept=".csv" required />
            <div style={{ marginTop: 16 }}>
              <button type="submit" disabled={pending}>
                {pending ? "กำลังนำเข้า..." : "นำเข้า"}
              </button>
            </div>
          </form>

          {result && (
            <div style={{ marginTop: 16 }}>
              <p className="badge success">นำเข้าสำเร็จ {result.imported} รายการ</p>
              {result.skipped.length > 0 && (
                <>
                  <p style={{ color: "var(--danger)", fontWeight: 600, marginTop: 8 }}>ข้าม {result.skipped.length} แถว:</p>
                  <ul style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    {result.skipped.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer" style={{ justifyContent: "flex-end" }}>
          <button className="secondary" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
