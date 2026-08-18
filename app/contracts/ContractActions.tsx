"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteContract } from "./actions";
import { formatDateBE } from "@/lib/date-utils";

export default function ContractActions({
  contractId,
  signed,
  roomNumber,
  tenantName,
}: {
  contractId: number;
  signed: boolean;
  roomNumber: string;
  tenantName: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handlePrint() {
    const originalTitle = document.title;
    const safe = (s: string) => s.replace(/\s+/g, "_");
    document.title = `สัญญาเช่า_${safe(roomNumber)}_${safe(tenantName)}_${formatDateBE(new Date())}`;
    window.print();
    document.title = originalTitle;
  }

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
      <button className="secondary" onClick={handlePrint}>
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
