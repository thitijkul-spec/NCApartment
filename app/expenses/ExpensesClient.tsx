"use client";

import { useMemo, useState } from "react";
import type { Contact, Account } from "@prisma/client";
import type { ExpenseWithRelations } from "./types";
import { EXPENSE_CATEGORIES, expensePaymentStatus } from "./types";
import ExpenseFormModal from "./ExpenseFormModal";
import ExpensePaymentModal from "./ExpensePaymentModal";
import { deleteExpense } from "./actions";
import { formatDateBE } from "@/lib/date-utils";
import { WalletIcon, PlusIcon } from "../icons";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4", "#a855f7", "#64748b"];

const STATUS_LABEL: Record<string, string> = { unpaid: "ยังไม่จ่าย", partial: "จ่ายบางส่วน", paid: "จ่ายแล้ว" };

export default function ExpensesClient({
  expenses,
  contacts,
  accounts,
  buildingName,
}: {
  expenses: ExpenseWithRelations[];
  contacts: Contact[];
  accounts: Account[];
  buildingName: string;
}) {
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<ExpenseWithRelations | null>(null);
  const [payingExpense, setPayingExpense] = useState<ExpenseWithRelations | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  const now = new Date();
  const thisMonthExpenses = expenses.filter((e) => {
    const d = new Date(e.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const thisMonthTotal = thisMonthExpenses.reduce((s, e) => s + e.totalAmount, 0);
  const thisYearExpenses = expenses.filter((e) => new Date(e.date).getFullYear() === now.getFullYear());
  const thisYearTotal = thisYearExpenses.reduce((s, e) => s + e.totalAmount, 0);
  const monthsWithData = new Set(thisYearExpenses.map((e) => new Date(e.date).getMonth())).size || 1;
  const avgPerMonth = thisYearTotal / monthsWithData;

  const categoryPie = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of thisMonthExpenses) {
      for (const li of e.lineItems) {
        map.set(li.category, (map.get(li.category) ?? 0) + li.totalWithVat);
      }
    }
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [thisMonthExpenses]);

  const monthlyBar = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of thisYearExpenses) {
      const key = String(new Date(e.date).getMonth() + 1);
      map.set(key, (map.get(key) ?? 0) + e.totalAmount);
    }
    return Array.from({ length: 12 }, (_, i) => ({ month: `${i + 1}`, amount: map.get(String(i + 1)) ?? 0 }));
  }, [thisYearExpenses]);

  const filtered = useMemo(() => {
    return expenses.filter((e) => {
      if (categoryFilter !== "all" && !e.lineItems.some((li) => li.category === categoryFilter)) return false;
      if (statusFilter !== "all" && expensePaymentStatus(e) !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matches =
          e.documentNo.toLowerCase().includes(q) ||
          (e.vendorNameSnapshot ?? "").toLowerCase().includes(q) ||
          e.lineItems.some((li) => li.title.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [expenses, categoryFilter, statusFilter, search]);

  function handleDelete(e: ExpenseWithRelations) {
    if (!confirm(`ยืนยันลบรายการ "${e.documentNo}" ถาวร?`)) return;
    const formData = new FormData();
    formData.set("expenseId", String(e.id));
    deleteExpense(formData).then(() => notify("ลบแล้ว"));
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header-title">
            <WalletIcon size={24} /> ค่าใช้จ่าย
          </div>
          <p className="page-header-subtitle">บันทึกและติดตามค่าใช้จ่ายของ {buildingName}</p>
        </div>
        <div className="page-header-actions">
          <button onClick={() => setShowAdd(true)}>
            <PlusIcon size={16} /> บันทึกค่าใช้จ่าย
          </button>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="stat-cards" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 }}>
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
          <h3 style={{ fontSize: 14, marginBottom: 8 }}>ค่าใช้จ่ายรายเดือนทั้งปี</h3>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyBar}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip formatter={(v: number) => `฿${v.toLocaleString()}`} />
              <Bar dataKey="amount" fill="#6366f1" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="tabs" style={{ marginBottom: 12 }}>
        <button className={`tab${categoryFilter === "all" ? " active" : ""}`} onClick={() => setCategoryFilter("all")}>
          ทุกหมวด
        </button>
        {EXPENSE_CATEGORIES.map((c) => (
          <button key={c} className={`tab${categoryFilter === c ? " active" : ""}`} onClick={() => setCategoryFilter(c)}>
            {c}
          </button>
        ))}
      </div>

      <div className="form-row" style={{ marginBottom: 16 }}>
        <input placeholder="ค้นหาเลขที่เอกสาร, ผู้ขาย, รายการ..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 260 }} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">ทุกสถานะจ่าย</option>
          <option value="unpaid">ยังไม่จ่าย</option>
          <option value="partial">จ่ายบางส่วน</option>
          <option value="paid">จ่ายแล้ว</option>
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th>เลขที่เอกสาร</th>
            <th>รายการ</th>
            <th>ประเภท</th>
            <th>วันที่</th>
            <th>ยอดรวม</th>
            <th>สถานะจ่าย</th>
            <th>การดำเนินการ</th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((e) => {
            const status = expensePaymentStatus(e);
            return (
              <tr key={e.id}>
                <td>{e.documentNo}</td>
                <td>
                  {e.lineItems[0]?.title ?? "-"}
                  {e.lineItems.length > 1 && ` +${e.lineItems.length - 1}`}
                  {e.vendorNameSnapshot && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{e.vendorNameSnapshot}</div>}
                </td>
                <td>{e.lineItems[0]?.category ?? "-"}</td>
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
                      <button className="secondary" onClick={() => setPayingExpense(e)}>
                        จ่ายเงิน
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
      {filtered.length === 0 && <p className="empty">ยังไม่มีค่าใช้จ่ายตามเงื่อนไขนี้</p>}

      {showAdd && <ExpenseFormModal expense={null} contacts={contacts} accounts={accounts} onClose={() => setShowAdd(false)} onSaved={notify} />}
      {editing && <ExpenseFormModal expense={editing} contacts={contacts} accounts={accounts} onClose={() => setEditing(null)} onSaved={notify} />}
      {payingExpense && (
        <ExpensePaymentModal
          expense={expenses.find((e) => e.id === payingExpense.id) ?? payingExpense}
          accounts={accounts}
          onClose={() => setPayingExpense(null)}
          onSaved={(msg) => {
            notify(msg);
            const updated = expenses.find((e) => e.id === payingExpense.id);
            if (updated && expensePaymentStatus(updated) === "paid") setPayingExpense(null);
          }}
        />
      )}
    </div>
  );
}
