"use client";

import type { RepairRequest, Room, Parcel, Contract, Tenant, AuditLog } from "@prisma/client";
import { formatDateBE, formatDateTimeBE } from "@/lib/date-utils";
import { DashboardIcon, DoorIcon, TrendUpIcon, TrendDownIcon, WalletIcon, PersonIcon, PackageIcon, WrenchIcon } from "./icons";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

const ACTION_COLOR: Record<string, string> = { create: "#22c55e", delete: "#ef4444", payment: "#06b6d4", status_change: "#0ea5e9" };

function relativeTime(d: Date) {
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  return `${Math.floor(hours / 24)} วันที่แล้ว`;
}

export default function DashboardClient({
  buildingName,
  isOwner,
  roomStats,
  occupancyRate,
  revenueThisMonth,
  expenseThisMonth,
  overdueCount,
  overdueTotal,
  chartData,
  pendingRepairs,
  overdueParcels,
  contractsNearExpiry,
  auditLogs,
}: {
  buildingName: string;
  isOwner: boolean;
  roomStats: { total: number; available: number; occupied: number };
  occupancyRate: number;
  revenueThisMonth: number;
  expenseThisMonth: number;
  overdueCount: number;
  overdueTotal: number;
  chartData: { label: string; revenue: number; expense: number; occupancy: number }[];
  pendingRepairs: (RepairRequest & { room: Room })[];
  overdueParcels: (Parcel & { room: Room | null })[];
  contractsNearExpiry: (Contract & { room: Room; tenant: Tenant; daysLeft: number })[];
  auditLogs: AuditLog[];
}) {
  const today = new Date();

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header-title">
            <DashboardIcon size={24} /> ภาพรวม
          </div>
          <p className="page-header-subtitle">
            สรุปข้อมูลสาขา {buildingName} · {formatDateBE(today)}
          </p>
        </div>
        <div className="page-header-actions" style={{ flexWrap: "wrap" }}>
          <a className="secondary btn" href="/tenants">
            <PersonIcon size={14} /> + เพิ่มผู้เช่า
          </a>
          <a className="secondary btn" href="/parcels">
            <PackageIcon size={14} /> + บันทึกพัสดุ
          </a>
          <a className="secondary btn" href="/repairs">
            <WrenchIcon size={14} /> + แจ้งซ่อม
          </a>
          <a className="secondary btn" href="/expenses">
            <WalletIcon size={14} /> + บันทึกค่าใช้จ่าย
          </a>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 12 }}>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>ห้องทั้งหมด / ว่าง / มีผู้เช่า</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {roomStats.total} / {roomStats.available} / {roomStats.occupied}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Occupancy {occupancyRate}%</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>รายรับเดือนนี้</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--success)" }}>฿{revenueThisMonth.toLocaleString()}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>รายจ่ายเดือนนี้</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "var(--danger)" }}>฿{expenseThisMonth.toLocaleString()}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>บิลค้างชำระ</div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>
            {overdueCount} ใบ · ฿{overdueTotal.toLocaleString()}
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>รายรับ vs รายจ่าย (6 เดือนย้อนหลัง)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis />
              <Tooltip formatter={(v: number) => `฿${v.toLocaleString()}`} />
              <Legend />
              <Line type="monotone" dataKey="revenue" name="รายรับ" stroke="#22c55e" />
              <Line type="monotone" dataKey="expense" name="รายจ่าย" stroke="#ef4444" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>Occupancy Rate (6 เดือนย้อนหลัง)</h3>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" />
              <YAxis unit="%" />
              <Tooltip formatter={(v: number) => `${v}%`} />
              <Line type="monotone" dataKey="occupancy" name="Occupancy %" stroke="#6366f1" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>งานแจ้งซ่อมค้าง</h3>
          {pendingRepairs.length === 0 ? (
            <p className="empty">ไม่มีงานค้าง</p>
          ) : (
            pendingRepairs.map((r) => (
              <div key={r.id} style={{ fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                ห้อง {r.room.roomNumber} — {r.title}
              </div>
            ))
          )}
          <a className="secondary btn" href="/repairs" style={{ marginTop: 8, display: "inline-block" }}>
            ดูทั้งหมด
          </a>
        </div>
        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>พัสดุตกค้าง</h3>
          {overdueParcels.length === 0 ? (
            <p className="empty">ไม่มีพัสดุตกค้าง</p>
          ) : (
            overdueParcels.map((p) => (
              <div key={p.id} style={{ fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                {p.recipientName} {p.room && `— ห้อง ${p.room.roomNumber}`}
              </div>
            ))
          )}
          <a className="secondary btn" href="/parcels" style={{ marginTop: 8, display: "inline-block" }}>
            ดูทั้งหมด
          </a>
        </div>
        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>สัญญาใกล้หมดอายุ</h3>
          {contractsNearExpiry.length === 0 ? (
            <p className="empty">ไม่มีสัญญาใกล้หมดอายุ</p>
          ) : (
            contractsNearExpiry.map((c) => (
              <div key={c.id} style={{ fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                ห้อง {c.room.roomNumber} — {c.tenant.name} (เหลือ {c.daysLeft} วัน)
              </div>
            ))
          )}
          <a className="secondary btn" href="/tenants" style={{ marginTop: 8, display: "inline-block" }}>
            ดูทั้งหมด
          </a>
        </div>
      </div>

      {isOwner && (
        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>กิจกรรมล่าสุด</h3>
          {auditLogs.length === 0 ? (
            <p className="empty">ยังไม่มีกิจกรรม</p>
          ) : (
            auditLogs.map((l) => (
              <div key={l.id} style={{ display: "flex", gap: 10, fontSize: 13, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: ACTION_COLOR[l.actionType] ?? "#94a3b8", marginTop: 5, flexShrink: 0 }} />
                <div>
                  {l.description}
                  <div style={{ color: "var(--text-muted)", fontSize: 12 }}>{relativeTime(new Date(l.createdAt))}</div>
                </div>
              </div>
            ))
          )}
          <a className="secondary btn" href="/audit" style={{ marginTop: 8, display: "inline-block" }}>
            ดูทั้งหมด
          </a>
        </div>
      )}
    </div>
  );
}
