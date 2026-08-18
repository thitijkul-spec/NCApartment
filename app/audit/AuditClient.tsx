"use client";

import { useMemo, useState } from "react";
import type { AuditLog } from "@prisma/client";
import { HistoryIcon } from "../icons";

const ACTION_LABEL: Record<string, string> = { create: "สร้าง", delete: "ลบ", payment: "เงิน", status_change: "เปลี่ยนสถานะ" };
const ACTION_COLOR: Record<string, string> = { create: "#22c55e", delete: "#ef4444", payment: "#06b6d4", status_change: "#0ea5e9" };

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function thaiDateHeader(d: Date) {
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}

function relativeTime(d: Date) {
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hours / 24);
  return `${days} วันที่แล้ว`;
}

export default function AuditClient({ logs, buildingName }: { logs: AuditLog[]; buildingName: string }) {
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  const modules = useMemo(() => Array.from(new Set(logs.map((l) => l.moduleTag))), [logs]);

  const now = new Date();
  const todayCount = logs.filter((l) => {
    const d = new Date(l.createdAt);
    return d.toDateString() === now.toDateString();
  }).length;
  const last7Count = logs.filter((l) => Date.now() - new Date(l.createdAt).getTime() <= 7 * 24 * 60 * 60 * 1000).length;

  const activeUsersToday = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of logs) {
      const d = new Date(l.createdAt);
      if (d.toDateString() !== now.toDateString()) continue;
      map.set(l.actorNameSnapshot, (map.get(l.actorNameSnapshot) ?? 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [logs]);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (moduleFilter !== "all" && l.moduleTag !== moduleFilter) return false;
      if (actionFilter !== "all" && l.actionType !== actionFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (!l.description.toLowerCase().includes(q) && !l.entityLabel.toLowerCase().includes(q) && !l.actorNameSnapshot.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [logs, moduleFilter, actionFilter, search]);

  const groups = useMemo(() => {
    const map = new Map<string, AuditLog[]>();
    for (const l of filtered) {
      const key = new Date(l.createdAt).toDateString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(l);
    }
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header-title">
            <HistoryIcon size={24} /> ประวัติการใช้งาน
          </div>
          <p className="page-header-subtitle">ดูประวัติการจัดการข้อมูลทั้งหมดของสาขา {buildingName}</p>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>วันนี้</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{todayCount}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>7 วันล่าสุด</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{last7Count}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>ผู้ใช้งาน Active (วันนี้)</div>
          {activeUsersToday.length === 0 ? (
            <div style={{ fontSize: 13, color: "var(--text-muted)" }}>ไม่มีกิจกรรมวันนี้</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
              {activeUsersToday.map(([name, count]) => (
                <div key={name} style={{ fontSize: 13, display: "flex", justifyContent: "space-between" }}>
                  <span>{name}</span>
                  <span style={{ color: "var(--text-muted)" }}>{count} ครั้ง</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="form-row" style={{ marginBottom: 16 }}>
        <input placeholder="ค้นหาประวัติ..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 240 }} />
        <select value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
          <option value="all">ทุกโมดูล</option>
          {modules.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          <option value="all">ทุกประเภท action</option>
          <option value="create">สร้าง</option>
          <option value="delete">ลบ</option>
          <option value="payment">เงิน</option>
          <option value="status_change">เปลี่ยนสถานะ</option>
        </select>
      </div>

      {groups.map(([dateKey, items]) => (
        <div key={dateKey} style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 8 }}>{thaiDateHeader(new Date(dateKey))}</h3>
          <div className="card" style={{ padding: 0 }}>
            {items.map((l, i) => (
              <div
                key={l.id}
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  padding: "12px 16px",
                  borderBottom: i < items.length - 1 ? "1px solid var(--border)" : "none",
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: ACTION_COLOR[l.actionType] ?? "#94a3b8",
                    marginTop: 6,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14 }}>{l.description}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {l.actorNameSnapshot} · {l.moduleTag} · {relativeTime(new Date(l.createdAt))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {groups.length === 0 && <p className="empty">ยังไม่มีประวัติการใช้งานตามเงื่อนไขนี้</p>}
    </div>
  );
}
