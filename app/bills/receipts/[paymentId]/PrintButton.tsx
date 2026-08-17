"use client";

export default function PrintButton() {
  return (
    <button className="secondary" onClick={() => window.print()}>
      พิมพ์ / บันทึก PDF
    </button>
  );
}
