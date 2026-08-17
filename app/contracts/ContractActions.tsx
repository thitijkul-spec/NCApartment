"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteContract } from "./actions";

export default function ContractActions({ contractId, signed }: { contractId: number; signed: boolean }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleDelete() {
    const msg = signed
      ? "สัญญานี้เซ็นแล้ว ลบถาวรไม่ได้ ต้องการเก็บเข้าคลัง (archive) แทนหรือไม่?"
      : "ยืนยันลบสัญญานี้ถาวร?";
    if (!confirm(msg)) return;
    const formData = new FormData();
    formData.set("contractId", String(contractId));
    startTransition(async () => {
      const result = await deleteContract(formData);
      if (result?.error) alert(result.error);
    });
  }

  return (
    <div className="no-print" style={{ display: "flex", gap: 8 }}>
      <button className="secondary" onClick={() => window.print()}>
        พิมพ์ / บันทึก PDF
      </button>
      <a href={`/contracts/${contractId}/edit`} className="secondary btn">
        แก้ไข
      </a>
      <button className="danger" onClick={handleDelete} disabled={pending}>
        {signed ? "เก็บเข้าคลัง" : "ลบ"}
      </button>
    </div>
  );
}
