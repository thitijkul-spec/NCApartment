"use client";

import { useRef, useState, useTransition } from "react";
import { saveSignature } from "./actions";

export default function SignatureCanvas({ contractId }: { contractId: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(true);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function getCtx() {
    return canvasRef.current?.getContext("2d") ?? null;
  }

  function pointerPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const ctx = getCtx();
    const { x, y } = pointerPos(e);
    ctx?.beginPath();
    ctx?.moveTo(x, y);
    setEmpty(false);
  }
  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0f172a";
    ctx.lineTo(x, y);
    ctx.stroke();
  }
  function handlePointerUp() {
    drawing.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    setEmpty(true);
  }

  function save() {
    const canvas = canvasRef.current;
    if (!canvas || empty) {
      setError("กรุณาเซ็นชื่อก่อนบันทึก");
      return;
    }
    setError(null);
    const dataUrl = canvas.toDataURL("image/png");
    const formData = new FormData();
    formData.set("contractId", String(contractId));
    formData.set("signatureData", dataUrl);
    startTransition(async () => {
      const result = await saveSignature(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="no-print">
      {error && <div className="form-error">{error}</div>}
      <p style={{ fontSize: 13, color: "var(--text-muted)" }}>ผู้เช่าเซ็นชื่อในกรอบด้านล่าง (ใช้นิ้ว/ปากกาบนหน้าจอสัมผัส เช่น iPad)</p>
      <canvas
        ref={canvasRef}
        width={500}
        height={180}
        style={{ border: "1px solid var(--border)", borderRadius: 10, background: "#fff", touchAction: "none", width: "100%", maxWidth: 500 }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="button" className="secondary" onClick={clear}>
          ล้าง
        </button>
        <button type="button" onClick={save} disabled={pending}>
          {pending ? "กำลังบันทึก..." : "ยืนยันลายเซ็น"}
        </button>
      </div>
    </div>
  );
}
