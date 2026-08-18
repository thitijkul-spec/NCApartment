"use client";

import type { ReactNode } from "react";
import { formatDateBE } from "@/lib/date-utils";

export default function ReportShell({
  title,
  subtitle,
  excelHeaders,
  excelRows,
  filenamePrefix,
  filterBar,
  children,
}: {
  title: string;
  subtitle: string;
  excelHeaders: string[];
  excelRows: (string | number)[][];
  filenamePrefix: string;
  filterBar?: ReactNode;
  children: ReactNode;
}) {
  async function exportExcel() {
    const XLSX = await import("xlsx");
    const ws = XLSX.utils.aoa_to_sheet([excelHeaders, ...excelRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `${filenamePrefix}_${formatDateBE(new Date()).replace(/-/g, "")}.xlsx`);
  }

  function exportPdf() {
    window.print();
  }

  return (
    <div>
      <div className="page-header no-print">
        <div>
          <div className="page-header-title">{title}</div>
          <p className="page-header-subtitle">{subtitle}</p>
        </div>
        <div className="page-header-actions">
          <a className="secondary btn" href="/reports">
            ← กลับสารบัญ
          </a>
          <button className="secondary" onClick={exportExcel}>
            Export Excel
          </button>
          <button className="secondary" onClick={exportPdf}>
            Export PDF
          </button>
        </div>
      </div>

      <div style={{ textAlign: "center", marginBottom: 8 }} className="print-only">
        <h2>{title}</h2>
        <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {subtitle} · พิมพ์เมื่อ {formatDateBE(new Date())}
        </p>
      </div>

      {filterBar && <div className="no-print" style={{ marginBottom: 16 }}>{filterBar}</div>}

      {children}
    </div>
  );
}
