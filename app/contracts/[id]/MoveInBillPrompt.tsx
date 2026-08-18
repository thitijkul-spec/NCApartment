"use client";

import { useState } from "react";
import { issueMoveInBill } from "../../bills/actions";

export default function MoveInBillPrompt({ contractId }: { contractId: number }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="no-print form-error" style={{ background: "var(--warning-soft)", color: "var(--warning)" }}>
      <p>สัญญาบันทึกแล้ว — ต้องการออกบิลแรกเข้า (เงินประกัน + ค่าเช่าล่วงหน้า) และรับเงินจากผู้เช่าเลยหรือไม่?</p>
      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <button type="button" className="secondary" onClick={() => setDismissed(true)}>
          ทำทีหลัง
        </button>
        <form action={issueMoveInBill}>
          <input type="hidden" name="contractId" value={contractId} />
          <button type="submit">ออกบิลแรกเข้า</button>
        </form>
      </div>
    </div>
  );
}
