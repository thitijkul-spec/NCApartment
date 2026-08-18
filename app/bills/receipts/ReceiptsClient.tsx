"use client";

import { useMemo, useState } from "react";
import type { Payment, Bill, Room, Tenant } from "@prisma/client";
import { WalletIcon } from "../../icons";

type PaymentRow = Payment & { bill: Bill & { room: Room; tenant: Tenant } };

import { formatDateBE } from "@/lib/date-utils";

function fmtDate(d: Date | string) {
  return formatDateBE(d);
}

export default function ReceiptsClient({ payments, buildingName }: { payments: PaymentRow[]; buildingName: string }) {
  const [search, setSearch] = useState("");
  const [docType, setDocType] = useState<"all" | "receipt" | "tax_invoice">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      if (docType === "tax_invoice" && !p.taxInvoiceNo) return false;
      if (from && new Date(p.paidAt) < new Date(from)) return false;
      if (to && new Date(p.paidAt) > new Date(new Date(to).getTime() + 86400000)) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (
          !p.receiptNo?.toLowerCase().includes(q) &&
          !(p.taxInvoiceNo ?? "").toLowerCase().includes(q) &&
          !p.bill.tenant.name.toLowerCase().includes(q) &&
          !p.bill.room.roomNumber.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [payments, search, docType, from, to]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header-title">
            <WalletIcon size={24} /> รายการใบเสร็จ
          </div>
          <p className="page-header-subtitle">{buildingName}</p>
        </div>
        <div className="page-header-actions">
          <a href="/bills" className="secondary btn">
            ← กลับหน้าบิล
          </a>
        </div>
      </div>

      <div className="form-row" style={{ marginBottom: 16 }}>
        <input placeholder="ค้นหาเลขที่เอกสาร, ชื่อผู้เช่า, เลขห้อง..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 240 }} />
        <select value={docType} onChange={(e) => setDocType(e.target.value as any)}>
          <option value="all">ทุกประเภทเอกสาร</option>
          <option value="tax_invoice">มีใบกำกับภาษี</option>
        </select>
        <div className="field">
          <label>ตั้งแต่</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label>ถึง</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>เลขที่ใบเสร็จ</th>
            <th>ใบกำกับภาษี</th>
            <th>ห้อง</th>
            <th>ผู้เช่า</th>
            <th>จำนวนเงิน</th>
            <th>วันที่</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((p) => (
            <tr key={p.id}>
              <td>{p.receiptNo}</td>
              <td>{p.taxInvoiceNo ?? "-"}</td>
              <td>{p.bill.room.roomNumber}</td>
              <td>{p.bill.tenant.name}</td>
              <td>฿{p.amount.toLocaleString()}</td>
              <td>{fmtDate(p.paidAt)}</td>
              <td>
                <a href={`/bills/receipts/${p.id}`} className="secondary btn">
                  เปิด/พิมพ์
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && <p className="empty">ไม่พบใบเสร็จตามเงื่อนไขนี้</p>}
    </div>
  );
}
