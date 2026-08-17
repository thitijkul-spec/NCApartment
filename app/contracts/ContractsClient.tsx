"use client";

import { useMemo, useState } from "react";
import type { Contract, Tenant, Room } from "@prisma/client";
import { CalendarIcon } from "../icons";

type ContractRow = Contract & { tenant: Tenant; room: Room };

function fmtDate(d: Date | string | null | undefined) {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

export default function ContractsClient({ contracts, buildingName }: { contracts: ContractRow[]; buildingName: string }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return contracts;
    const q = search.trim().toLowerCase();
    return contracts.filter(
      (c) => c.tenant.name.toLowerCase().includes(q) || c.room.roomNumber.toLowerCase().includes(q)
    );
  }, [contracts, search]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header-title">
            <CalendarIcon size={24} /> เอกสารสัญญา
          </div>
          <p className="page-header-subtitle">สัญญาเช่าทั้งหมดของ {buildingName}</p>
        </div>
      </div>

      <input
        placeholder="ค้นหาชื่อผู้เช่า, เลขห้อง..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{ marginBottom: 16, minWidth: 280 }}
      />

      <table>
        <thead>
          <tr>
            <th>ผู้เช่า</th>
            <th>ห้อง</th>
            <th>ระยะเวลา</th>
            <th>ค่าเช่า/เดือน</th>
            <th>สถานะ</th>
            <th>การดำเนินการ</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((c) => (
            <tr key={c.id}>
              <td>{c.tenant.name}</td>
              <td>{c.room.roomNumber}</td>
              <td>
                {fmtDate(c.startDate)} — {c.noEndDate ? "ไม่มีกำหนด" : fmtDate(c.endDate)}
              </td>
              <td>฿{c.rentAmount.toLocaleString()}</td>
              <td>
                <span className={`badge ${c.signedAt ? "success" : "warning"}`}>{c.signedAt ? "เซ็นแล้ว" : "ยังไม่เซ็น"}</span>
              </td>
              <td>
                <div className="status-buttons">
                  <a href={`/contracts/${c.id}`} className="secondary btn">
                    เปิด/พิมพ์
                  </a>
                  <a href={`/contracts/${c.id}/edit`} className="secondary btn">
                    แก้ไข
                  </a>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filtered.length === 0 && <p className="empty">ยังไม่มีสัญญา</p>}
    </div>
  );
}
