"use client";

import { useMemo, useState } from "react";
import type { Contact, Account, Tenant } from "@prisma/client";
import type { OtherIncomeWithRelations } from "./types";
import { OTHER_INCOME_CATEGORIES, otherIncomePaymentStatus } from "./types";
import OtherIncomeFormModal from "./OtherIncomeFormModal";
import OtherIncomePaymentModal from "./OtherIncomePaymentModal";
import { deleteOtherIncome } from "./actions";
import { formatDateBE } from "@/lib/date-utils";
import { TrendUpIcon, PlusIcon } from "../icons";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#64748b", "#ec4899", "#84cc16", "#0ea5e9"];
const STATUS_LABEL: Record<string, string> = { unpaid: "ยังไม่รับ", partial: "รับบางส่วน", paid: "รับแล้ว" };

export default function OtherIncomeClient({
  items,
  contacts,
  tenants,
  accounts,
  buildingName,
}: {
  items: OtherIncomeWithRelations[];
  contacts: Contact[];
  tenants: Tenant[];
  accounts: Account[];
  buildingName: string;
}) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<OtherIncomeWithRelations | null>(null);
  const [receiving, setReceiving] = useState<OtherIncomeWithRelations | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  const now = new Date();
  const thisMonth = items.filter((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const thisMonthTotal = thisMonth.reduce((s, e) => s + e.totalAmount, 0);
  const thisYear = items.filter((e) => new Date(e.date).getFullYear() === now.getFullYear());
  const thisYearTotal = thisYear.reduce((s, e) => s + e.totalAmount, 0);
  const monthsWithData = new Set(thisYear.map((e) => new Date(e.date).getMonth())).size || 1;
  const avgPerMonth = thisYearTotal / monthsWithData;

  const categoryPie = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of thisMonth) for (const li of e.lineItems) map.set(li.category, (map.get(li.category) ?? 0) + li.totalWithVat);
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [thisMonth]);

  const monthlyBar = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of thisYear) {
      const key = String(new Date(e.date).getMonth() + 1);
      map.set(key, (map.get(key) ?? 0) + e.totalAmount);
    }
    return Array.from({ length: 12 }, (_, i) => ({ month: `${i + 1}`, amount: map.get(String(i + 1)) ?? 0 }));
  }, [thisYear]);

  const filtered = useMemo(() => {
    return items.filter((e) => {
      if (categoryFilter !== "all" && !e.lineItems.some((li) => li.category === categoryFilter)) return false;
      if (statusFilter !== "all" && otherIncomePaymentStatus(e) !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matches =
          e.documentNo.toLowerCase().includes(q) ||
          (e.buyerNameSnapshot ?? "").toLowerCase().includes(q) ||
          e.lineItems.some((li) => li.title.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [items, categoryFilter, statusFilter, search]);

  function handleDelete(e: OtherIncomeWithRelations) {
    if (!confirm(`ยืนยันลบรายการ "${e.documentNo}" ถาวร?`)) return;
    const formData = new FormData();
    formData.set("otherIncomeId", String(e.id));
    deleteOtherIncome(formData).then(() => notify("ลบแล้ว"));
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header-title">
            <TrendUpIcon size={24} /> รายได้อื่นๆ
          </div>
          <p className="page-header-subtitle">บันทึกและติดตามรายได้อื่นๆ ของ {buildingName}</p>
        </div>
        <div className="page-header-actions">
          <button onClick={() => setShowAdd(true)}>
            <PlusIcon size={16} /> บันทึกรายได้อื่นๆ
          </button>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>รวมเดือนนี้</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>฿{thisMonthTotal.toLocaleString()}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>รวมทั้งปี</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>฿{thisYearTotal.toLocaleString()}</div>
        </div>
        <div className="card">
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>เฉลี่ยต่อเดือน</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>฿{avgPerMonth.toLocaleString(undefined, { maximumFractionDigits: 0 })}</div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>สัดส่วนตามประเภท (เดือนนี้)</h3>
          {categoryPie.length === 0 ? (
            <p className="empty">ยังไม่มีข้อมูล</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryPie} dataKey="value" nameKey="name" outerRadius={80} innerRadius={40}>
                  {categoryPie.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `฿${v.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="card">
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>รายได้อื่นๆ รายเดือนทั้งปี</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyBar}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v: number) => `฿${v.toLocaleString()}`} />
              <Bar dataKey="amount" fill="#22c55e" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 12, flexWrap: "wrap" }}>
        <button className={`tab${categoryFilter === "all" ? " active" : ""}`} onClick={() => setCategoryFilter("all")}>
          ทุกหมวด
        </button>
        {OTHER_INCOME_CATEGORIES.map((c) => (
          <button key={c} className={`tab${categoryFilter === c ? " active" : ""}`} onClick={() => setCategoryFilter(c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="form-row" style={{ marginBottom: 16 }}>
        <input placeholder="ค้นหาเลขที่เอกสาร, ผู้ซื้อ, รายการ..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 260 }} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">ทุกสถานะรับ</option>
          <option value="unpaid">ยังไม่รับ</option>
          <option value="partial">รับบางส่วน</option>
          <option value="paid">รับแล้ว</option>
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th>เลขที่เอกสาร</th>
            <th>รายการ</th>
            <th>ประเภท</th>
            <th>ผู้ซื้อ</th>
            <th>วันที่</th>
            <th>ยอดรวม</th>
            <th>สถานะรับ</th>
            <th>การดำเนินการ</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((e) => {
            const status = otherIncomePaymentStatus(e);
            return (
              <tr key={e.id}>
                <td>{e.documentNo}</td>
                <td>
                  {e.lineItems[0]?.title ?? "-"}
                  {e.lineItems.length > 1 && ` +${e.lineItems.length - 1}`}
                </td>
                <td>{e.lineItems[0]?.category ?? "-"}</td>
                <td>{e.buyerNameSnapshot ?? "-"}</td>
                <td>{formatDateBE(e.date)}</td>
                <td>฿{e.totalAmount.toLocaleString()}</td>
                <td>
                  <span className={`badge ${status === "paid" ? "success" : status === "partial" ? "warning" : "neutral"}`}>
                    {STATUS_LABEL[status]}
                  </span>
                </td>
                <td>
                  <div className="status-buttons">
                    {status !== "paid" && (
                      <button className="secondary" onClick={() => setReceiving(e)}>
                        รับเงิน
                      </button>
                    )}
                    <button className="secondary" onClick={() => setEditing(e)}>
                      แก้ไข
                    </button>
                    <button className="danger" onClick={() => handleDelete(e)}>
                      ลบ
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {filtered.length === 0 && <p className="empty">ยังไม่มีรายได้อื่นๆ ตามเงื่อนไขนี้</p>}

      {showAdd && (
        <OtherIncomeFormModal item={null} contacts={contacts} tenants={tenants} accounts={accounts} onClose={() => setShowAdd(false)} onSaved={notify} />
      )}
      {editing && (
        <OtherIncomeFormModal item={editing} contacts={contacts} tenants={tenants} accounts={accounts} onClose={() => setEditing(null)} onSaved={notify} />
      )}
      {receiving && (
        <OtherIncomePaymentModal
          item={items.find((e) => e.id === receiving.id) ?? receiving}
          accounts={accounts}
          onClose={() => setReceiving(null)}
          onSaved={(msg) => {
            notify(msg);
            const updated = items.find((e) => e.id === receiving.id);
            if (updated && otherIncomePaymentStatus(updated) === "paid") setReceiving(null);
          }}
        />
      )}
    </div>
  );
}
