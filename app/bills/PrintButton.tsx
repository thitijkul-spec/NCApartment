"use client";

export default function PrintButton({ label = "พิมพ์ใบเสร็จ" }: { label?: string }) {
  return (
    <button type="button" className="secondary" onClick={() => window.print()}>
      {label}
    </button>
  );
}
