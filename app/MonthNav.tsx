"use client";

import { CalendarIcon } from "./icons";
import { formatMonthKeyTH } from "@/lib/date-utils";

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default function MonthNav({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  return (
    <div className="month-nav">
      <button type="button" className="month-nav-arrow" onClick={() => onChange(shiftMonth(month, -1))} title="เดือนก่อนหน้า">
        ‹
      </button>
      <label className="month-nav-label">
        <span style={{ pointerEvents: "none", display: "inline-flex", alignItems: "center", gap: 6 }}>
          <CalendarIcon size={14} /> {formatMonthKeyTH(month)}
        </span>
        <input type="month" value={month} onChange={(e) => e.target.value && onChange(e.target.value)} />
      </label>
      <button type="button" className="month-nav-arrow" onClick={() => onChange(shiftMonth(month, 1))} title="เดือนถัดไป">
        ›
      </button>
    </div>
  );
}
