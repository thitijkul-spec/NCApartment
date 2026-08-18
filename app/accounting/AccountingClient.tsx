"use client";

import { useState, useTransition } from "react";
import type {
  Payment,
  Bill,
  BillLineItem,
  Room,
  Tenant,
  OtherIncome,
  OtherIncomeLineItem,
  OtherIncomePayment,
  Contact,
  Contract,
  Deposit,
  Expense,
  ExpenseLineItem,
  ExpensePayment,
  DailyBill,
  Account,
} from "@prisma/client";
import { formatDateBE } from "@/lib/date-utils";
import { createAccount, updateAccount, updateAccountStatus, deleteAccount, returnDepositAction, forfeitDepositAction, issueDailyBill } from "./actions";
import { WalletIcon, PlusIcon } from "../icons";

type PaymentRow = Payment & { bill: Bill & { room: Room; tenant: Tenant } };
type BillRow = Bill & { room: Room; tenant: Tenant; lineItems: BillLineItem[]; payments: Payment[] };
type OtherIncomeRow = OtherIncome & { buyerContact: Contact | null; buyerTenant: Tenant | null; lineItems: OtherIncomeLineItem[]; payments: OtherIncomePayment[] };
type ContractRow = Contract & { room: Room; tenant: Tenant };
type DepositRow = Deposit & { room: Room; contract: (Contract & { tenant: Tenant }) | null };
type ExpenseRow = Expense & { vendorContact: Contact | null; lineItems: ExpenseLineItem[]; payments: ExpensePayment[] };
type DailyBillRow = DailyBill & { room: Room; tenant: Tenant; account: Account };

const REGISTRY_TABS = ["ใบเสร็จรับเงิน", "ใบแจ้งหนี้", "รายได้อื่นๆ", "สัญญาเช่า", "เงินมัดจำ", "ค่าใช้จ่าย", "บิลรายวัน"] as const;
const MAIN_TABS = ["ทะเบียนเอกสาร", "บัญชีแยกประเภท", "จัดการบัญชี", "ยอดค้างชำระ/ค้างรับ"] as const;

export default function AccountingClient({
  buildingName,
  payments,
  bills,
  otherIncomes,
  contracts,
  deposits,
  expenses,
  dailyBills,
  accounts,
  activeAccounts,
  accountBalances,
  dailyRooms,
  dailyTenants,
  receivables,
  payables,
}: {
  buildingName: string;
  payments: PaymentRow[];
  bills: BillRow[];
  otherIncomes: OtherIncomeRow[];
  contracts: ContractRow[];
  deposits: DepositRow[];
  expenses: ExpenseRow[];
  dailyBills: DailyBillRow[];
  accounts: Account[];
  activeAccounts: Account[];
  accountBalances: number[];
  dailyRooms: Room[];
  dailyTenants: Tenant[];
  receivables: { tenantId: number; tenantName: string; rooms: string; billCount: number; balance: number }[];
  payables: { vendorName: string; billCount: number; balance: number }[];
}) {
  const [mainTab, setMainTab] = useState<(typeof MAIN_TABS)[number]>("ทะเบียนเอกสาร");
  const [registryTab, setRegistryTab] = useState<(typeof REGISTRY_TABS)[number]>("ใบเสร็จรับเงิน");
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(accounts[0]?.id ?? null);
  const [showDailyBill, setShowDailyBill] = useState(false);
  const [pending, startTransition] = useTransition();

  function notify(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  const q = search.trim().toLowerCase();

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header-title">
            <WalletIcon size={24} /> ฐานข้อมูลบัญชี
          </div>
          <p className="page-header-subtitle">รวมศูนย์ข้อมูลการเงินทั้งหมดของ {buildingName}</p>
        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}

      <div className="tabs" style={{ marginBottom: 16 }}>
        {MAIN_TABS.map((t) => (
          <button key={t} className={`tab${mainTab === t ? " active" : ""}`} onClick={() => setMainTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {mainTab === "ทะเบียนเอกสาร" && (
        <div>
          <div className="tabs" style={{ marginBottom: 12, flexWrap: "wrap" }}>
            {REGISTRY_TABS.map((t) => (
              <button key={t} className={`tab${registryTab === t ? " active" : ""}`} onClick={() => setRegistryTab(t)}>
                {t}
              </button>
            ))}
          </div>
          <input placeholder="ค้นหา..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 16, minWidth: 260 }} />

          {registryTab === "ใบเสร็จรับเงิน" && (
            <table>
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>ห้อง</th>
                  <th>ผู้เช่า</th>
                  <th>จำนวนเงิน</th>
                  <th>วิธีชำระ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payments
                  .filter((p) => !q || p.bill.tenant.name.toLowerCase().includes(q) || p.bill.room.roomNumber.toLowerCase().includes(q))
                  .map((p) => (
                    <tr key={p.id}>
                      <td>{formatDateBE(p.paidAt)}</td>
                      <td>{p.bill.room.roomNumber}</td>
                      <td>{p.bill.tenant.name}</td>
                      <td>฿{p.amount.toLocaleString()}</td>
                      <td>{p.method === "cash" ? "เงินสด" : "โอนเงิน"}</td>
                      <td>
                        <a className="secondary btn" href={`/bills/receipts/${p.id}`}>
                          เปิด/พิมพ์
                        </a>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {registryTab === "ใบแจ้งหนี้" && (
            <table>
              <thead>
                <tr>
                  <th>เลขบิล</th>
                  <th>ห้อง</th>
                  <th>ผู้เช่า</th>
                  <th>งวด</th>
                  <th>ยอดรวม</th>
                  <th>สถานะ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {bills
                  .filter((b) => !q || b.tenant.name.toLowerCase().includes(q) || b.room.roomNumber.toLowerCase().includes(q) || b.billNo.toLowerCase().includes(q))
                  .map((b) => {
                    const total = b.lineItems.reduce((s, li) => s + li.amount, 0) - (b.discountAmount ?? 0);
                    return (
                      <tr key={b.id}>
                        <td>{b.billNo}</td>
                        <td>{b.room.roomNumber}</td>
                        <td>{b.tenant.name}</td>
                        <td>{b.billingMonth}</td>
                        <td>฿{total.toLocaleString()}</td>
                        <td>{b.status}</td>
                        <td>
                          <a className="secondary btn" href={`/bills/${b.id}`}>
                            เปิด/พิมพ์
                          </a>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}

          {registryTab === "รายได้อื่นๆ" && (
            <table>
              <thead>
                <tr>
                  <th>เลขที่เอกสาร</th>
                  <th>รายการ</th>
                  <th>ผู้ซื้อ</th>
                  <th>วันที่</th>
                  <th>ยอดรวม</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {otherIncomes
                  .filter((o) => !q || (o.buyerNameSnapshot ?? "").toLowerCase().includes(q) || o.documentNo.toLowerCase().includes(q))
                  .map((o) => (
                    <tr key={o.id}>
                      <td>{o.documentNo}</td>
                      <td>{o.lineItems[0]?.title ?? "-"}</td>
                      <td>{o.buyerNameSnapshot ?? "-"}</td>
                      <td>{formatDateBE(o.date)}</td>
                      <td>฿{o.totalAmount.toLocaleString()}</td>
                      <td>
                        <a className="secondary btn" href="/other-income">
                          เปิด
                        </a>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {registryTab === "สัญญาเช่า" && (
            <table>
              <thead>
                <tr>
                  <th>ห้อง</th>
                  <th>ผู้เช่า</th>
                  <th>วันเริ่ม</th>
                  <th>ค่าเช่า/เดือน</th>
                  <th>สถานะ</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {contracts
                  .filter((c) => !q || c.tenant.name.toLowerCase().includes(q) || c.room.roomNumber.toLowerCase().includes(q))
                  .map((c) => (
                    <tr key={c.id}>
                      <td>{c.room.roomNumber}</td>
                      <td>{c.tenant.name}</td>
                      <td>{formatDateBE(c.startDate)}</td>
                      <td>฿{c.rentAmount.toLocaleString()}</td>
                      <td>{c.signedAt ? "เซ็นแล้ว" : "ยังไม่เซ็น"}</td>
                      <td>
                        <a className="secondary btn" href={`/contracts/${c.id}`}>
                          เปิด/พิมพ์
                        </a>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {registryTab === "เงินมัดจำ" && (
            <DepositTab deposits={deposits} accounts={activeAccounts} search={q} onSaved={notify} />
          )}

          {registryTab === "ค่าใช้จ่าย" && (
            <table>
              <thead>
                <tr>
                  <th>เลขที่เอกสาร</th>
                  <th>รายการ</th>
                  <th>ผู้ขาย</th>
                  <th>วันที่</th>
                  <th>ยอดรวม</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {expenses
                  .filter((e) => !q || (e.vendorNameSnapshot ?? "").toLowerCase().includes(q) || e.documentNo.toLowerCase().includes(q))
                  .map((e) => (
                    <tr key={e.id}>
                      <td>{e.documentNo}</td>
                      <td>{e.lineItems[0]?.title ?? "-"}</td>
                      <td>{e.vendorNameSnapshot ?? "-"}</td>
                      <td>{formatDateBE(e.date)}</td>
                      <td>฿{e.totalAmount.toLocaleString()}</td>
                      <td>
                        <a className="secondary btn" href="/expenses">
                          เปิด
                        </a>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}

          {registryTab === "บิลรายวัน" && (
            <div>
              <button style={{ marginBottom: 12 }} onClick={() => setShowDailyBill(true)}>
                <PlusIcon size={14} /> ออกบิลรายวัน
              </button>
              <table>
                <thead>
                  <tr>
                    <th>เลขที่เอกสาร</th>
                    <th>ห้อง</th>
                    <th>ผู้เช่า</th>
                    <th>วันเข้าพัก</th>
                    <th>จำนวนคืน</th>
                    <th>รวม</th>
                    <th>มัดจำ</th>
                    <th>วิธีชำระ</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyBills
                    .filter((d) => !q || d.tenant.name.toLowerCase().includes(q) || d.room.roomNumber.toLowerCase().includes(q))
                    .map((d) => (
                      <tr key={d.id}>
                        <td>{d.documentNo}</td>
                        <td>{d.room.roomNumber}</td>
                        <td>{d.tenant.name}</td>
                        <td>{formatDateBE(d.checkinDate)}</td>
                        <td>{d.nights}</td>
                        <td>฿{d.totalAmount.toLocaleString()}</td>
                        <td>{d.depositAmountSnapshot ? `฿${d.depositAmountSnapshot.toLocaleString()}` : "-"}</td>
                        <td>{d.method}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              {dailyBills.length === 0 && <p className="empty">ยังไม่มีบิลรายวัน</p>}
            </div>
          )}
        </div>
      )}

      {mainTab === "บัญชีแยกประเภท" && (
        <LedgerTab accounts={accounts} balances={accountBalances} />
      )}

      {mainTab === "จัดการบัญชี" && (
        <AccountsTab accounts={accounts} balances={accountBalances} onSaved={notify} />
      )}

      {mainTab === "ยอดค้างชำระ/ค้างรับ" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div className="card">
            <h3>ค้างรับ (จากผู้เช่า)</h3>
            <table>
              <thead>
                <tr>
                  <th>ผู้เช่า</th>
                  <th>ห้อง</th>
                  <th>จำนวนบิลค้าง</th>
                  <th>ยอดค้างรวม</th>
                </tr>
              </thead>
              <tbody>
                {receivables.map((r) => (
                  <tr key={r.tenantId}>
                    <td>{r.tenantName}</td>
                    <td>{r.rooms}</td>
                    <td>{r.billCount}</td>
                    <td>฿{r.balance.toLocaleString()}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={3}>
                    <strong>ยอดรวมค้างรับ</strong>
                  </td>
                  <td>
                    <strong>฿{receivables.reduce((s, r) => s + r.balance, 0).toLocaleString()}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
            {receivables.length === 0 && <p className="empty">ไม่มีค้างรับ</p>}
          </div>
          <div className="card">
            <h3>ค้างจ่าย (ซื้อเชื่อ)</h3>
            <table>
              <thead>
                <tr>
                  <th>ผู้ขาย</th>
                  <th>จำนวนบิลค้าง</th>
                  <th>ยอดค้างรวม</th>
                </tr>
              </thead>
              <tbody>
                {payables.map((p, i) => (
                  <tr key={i}>
                    <td>{p.vendorName}</td>
                    <td>{p.billCount}</td>
                    <td>฿{p.balance.toLocaleString()}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={2}>
                    <strong>ยอดรวมค้างจ่าย</strong>
                  </td>
                  <td>
                    <strong>฿{payables.reduce((s, p) => s + p.balance, 0).toLocaleString()}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
            {payables.length === 0 && <p className="empty">ไม่มีค้างจ่าย</p>}
          </div>
        </div>
      )}

      {showDailyBill && (
        <DailyBillModal rooms={dailyRooms} tenants={dailyTenants} accounts={activeAccounts} onClose={() => setShowDailyBill(false)} onSaved={notify} />
      )}
    </div>
  );
}

function DepositTab({
  deposits,
  accounts,
  search,
  onSaved,
}: {
  deposits: DepositRow[];
  accounts: Account[];
  search: string;
  onSaved: (msg: string) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [returningId, setReturningId] = useState<number | null>(null);
  const [returnAccountId, setReturnAccountId] = useState<number | "">("");

  function handleForfeit(depositId: number) {
    if (!confirm("ยืนยันริบเงินมัดจำนี้ทั้งหมด? ระบบจะสร้างรายการรายได้อื่นๆ หมวด 'เงินมัดจำริบ' อัตโนมัติ")) return;
    const formData = new FormData();
    formData.set("depositId", String(depositId));
    startTransition(async () => {
      const result = await forfeitDepositAction(formData);
      if (result?.error) alert(result.error);
      else onSaved("ริบเงินมัดจำแล้ว");
    });
  }

  function handleReturn(depositId: number) {
    if (!returnAccountId) return;
    const formData = new FormData();
    formData.set("depositId", String(depositId));
    formData.set("accountId", String(returnAccountId));
    startTransition(async () => {
      const result = await returnDepositAction(formData);
      if (result?.error) alert(result.error);
      else {
        onSaved("คืนเงินมัดจำแล้ว");
        setReturningId(null);
      }
    });
  }

  const STATUS_LABEL: Record<string, string> = { held: "ถืออยู่", returned: "คืนแล้ว", forfeited: "ริบทั้งหมด" };

  return (
    <table>
      <thead>
        <tr>
          <th>ห้อง</th>
          <th>ผู้เช่า</th>
          <th>วันที่ทำสัญญา</th>
          <th>จำนวนเงินมัดจำ</th>
          <th>สถานะ</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {deposits
          .filter((d) => !search || d.room.roomNumber.toLowerCase().includes(search) || (d.contract?.tenant.name ?? "").toLowerCase().includes(search))
          .map((d) => (
            <tr key={d.id}>
              <td>{d.room.roomNumber}</td>
              <td>{d.contract?.tenant.name ?? "-"}</td>
              <td>{formatDateBE(d.collectedDate)}</td>
              <td>฿{d.amount.toLocaleString()}</td>
              <td>
                <span className={`badge ${d.status === "held" ? "warning" : d.status === "returned" ? "success" : "danger"}`}>
                  {STATUS_LABEL[d.status]}
                </span>
              </td>
              <td>
                {d.status === "held" && (
                  <div className="status-buttons">
                    {returningId === d.id ? (
                      <>
                        <select value={returnAccountId} onChange={(e) => setReturnAccountId(Number(e.target.value))} style={{ width: 140 }}>
                          <option value="">-- บัญชี --</option>
                          {accounts.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}
                            </option>
                          ))}
                        </select>
                        <button className="secondary" disabled={pending || !returnAccountId} onClick={() => handleReturn(d.id)}>
                          ยืนยันคืนเงิน
                        </button>
                        <button className="secondary" onClick={() => setReturningId(null)}>
                          ยกเลิก
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="secondary" onClick={() => setReturningId(d.id)}>
                          คืนเงิน
                        </button>
                        <button className="danger" disabled={pending} onClick={() => handleForfeit(d.id)}>
                          ริบเงิน
                        </button>
                      </>
                    )}
                  </div>
                )}
              </td>
            </tr>
          ))}
      </tbody>
      {deposits.length === 0 && (
        <tbody>
          <tr>
            <td colSpan={6} className="empty">
              ยังไม่มีเงินมัดจำ
            </td>
          </tr>
        </tbody>
      )}
    </table>
  );
}

function LedgerTab({ accounts, balances }: { accounts: Account[]; balances: number[] }) {
  const [selectedId, setSelectedId] = useState<number | "">(accounts[0]?.id ?? "");
  const [entries, setEntries] = useState<{ date: string; description: string; direction: string; amount: number }[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function loadEntries(accountId: number) {
    setLoading(true);
    try {
      const res = await fetch(`/api/accounting/ledger?accountId=${accountId}`);
      const data = await res.json();
      setEntries(data.entries);
    } finally {
      setLoading(false);
    }
  }

  const selectedAccount = accounts.find((a) => a.id === selectedId);

  return (
    <div>
      <div className="field" style={{ maxWidth: 320, marginBottom: 16 }}>
        <label>เลือกบัญชี</label>
        <select
          value={selectedId}
          onChange={(e) => {
            const id = Number(e.target.value);
            setSelectedId(id);
            loadEntries(id);
          }}
        >
          <option value="">-- เลือกบัญชี --</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

      {selectedAccount && (
        <>
          <p>ยอดยกมา: ฿{selectedAccount.openingBalance.toLocaleString()}</p>
          {loading && <p>กำลังโหลด...</p>}
          {entries && (
            <table>
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>รายการ</th>
                  <th>เดบิต</th>
                  <th>เครดิต</th>
                  <th>คงเหลือสะสม</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  let running = selectedAccount.openingBalance;
                  return entries.map((e, i) => {
                    running += e.direction === "in" ? e.amount : -e.amount;
                    return (
                      <tr key={i}>
                        <td>{formatDateBE(e.date)}</td>
                        <td>{e.description}</td>
                        <td>{e.direction === "in" ? `฿${e.amount.toLocaleString()}` : "-"}</td>
                        <td>{e.direction === "out" ? `฿${e.amount.toLocaleString()}` : "-"}</td>
                        <td>฿{running.toLocaleString()}</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          )}
          {entries && entries.length === 0 && <p className="empty">ยังไม่มีรายการเดินบัญชี</p>}
        </>
      )}
    </div>
  );
}

function AccountsTab({ accounts, balances, onSaved }: { accounts: Account[]; balances: number[]; onSaved: (msg: string) => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  function handleCreate(formData: FormData) {
    if (!confirm("ยืนยันเพิ่มบัญชีนี้?")) return;
    setError(null);
    startTransition(async () => {
      const result = await createAccount(formData);
      if (result?.error) setError(result.error);
      else onSaved("เพิ่มบัญชีแล้ว");
    });
  }

  function handleUpdate(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateAccount(formData);
      if (result?.error) alert(result.error);
      else {
        setEditingId(null);
        onSaved("บันทึกการแก้ไขบัญชีแล้ว");
      }
    });
  }

  return (
    <div>
      <div className="card">
        <h2>เพิ่มบัญชี</h2>
        {error && <div className="form-error">{error}</div>}
        <form action={handleCreate} className="form-row">
          <div className="field">
            <label>ชื่อบัญชี</label>
            <input name="name" required placeholder="เช่น ธ.กสิกรไทย - เจ้าของหอพัก" />
          </div>
          <div className="field">
            <label>ประเภท</label>
            <select name="type" defaultValue="bank">
              <option value="bank">บัญชีธนาคาร</option>
              <option value="cash">เงินสด</option>
              <option value="other">อื่นๆ</option>
            </select>
          </div>
          <div className="field">
            <label>เลขบัญชี</label>
            <input name="accountNumber" />
          </div>
          <div className="field">
            <label>ยอดยกมาเริ่มต้น</label>
            <input name="openingBalance" type="number" step="0.01" defaultValue={0} />
          </div>
          <div>
            <button type="submit" disabled={pending}>
              เพิ่ม
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <h2>รายชื่อบัญชี ({accounts.length})</h2>
        <table>
          <thead>
            <tr>
              <th>ชื่อบัญชี</th>
              <th>ประเภท</th>
              <th>เลขบัญชี</th>
              <th>ยอดยกมา</th>
              <th>ยอดคงเหลือปัจจุบัน</th>
              <th>สถานะ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a, i) => {
              const balance = balances[i];
              const canDelete = Math.round(balance * 100) === 0;
              if (editingId === a.id) {
                return (
                  <tr key={a.id}>
                    <td colSpan={7}>
                      <form
                        action={handleUpdate}
                        className="form-row"
                        style={{ alignItems: "flex-end" }}
                      >
                        <input type="hidden" name="accountId" value={a.id} />
                        <div className="field">
                          <label>ชื่อบัญชี</label>
                          <input name="name" required defaultValue={a.name} />
                        </div>
                        <div className="field">
                          <label>ประเภท</label>
                          <select name="type" defaultValue={a.type}>
                            <option value="bank">บัญชีธนาคาร</option>
                            <option value="cash">เงินสด</option>
                            <option value="other">อื่นๆ</option>
                          </select>
                        </div>
                        <div className="field">
                          <label>เลขบัญชี</label>
                          <input name="accountNumber" defaultValue={a.accountNumber ?? ""} />
                        </div>
                        <div className="field">
                          <label>ยอดยกมาเริ่มต้น</label>
                          <input name="openingBalance" type="number" step="0.01" defaultValue={a.openingBalance} />
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button type="button" className="secondary" onClick={() => setEditingId(null)}>
                            ยกเลิก
                          </button>
                          <button type="submit" disabled={pending}>
                            บันทึก
                          </button>
                        </div>
                      </form>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={a.id}>
                  <td>{a.name}</td>
                  <td>{a.type === "bank" ? "ธนาคาร" : a.type === "cash" ? "เงินสด" : "อื่นๆ"}</td>
                  <td>{a.accountNumber ?? "-"}</td>
                  <td>฿{a.openingBalance.toLocaleString()}</td>
                  <td>฿{balance.toLocaleString()}</td>
                  <td>
                    <span className={`badge ${a.status === "active" ? "success" : "neutral"}`}>{a.status === "active" ? "ใช้งาน" : "ปิดใช้งาน"}</span>
                  </td>
                  <td>
                    <div className="status-buttons">
                      <button type="button" className="secondary" onClick={() => setEditingId(a.id)}>
                        แก้ไข
                      </button>
                      <form
                        action={(fd) => {
                          startTransition(async () => {
                            await updateAccountStatus(fd);
                            onSaved("อัปเดตสถานะแล้ว");
                          });
                        }}
                      >
                        <input type="hidden" name="accountId" value={a.id} />
                        <input type="hidden" name="status" value={a.status === "active" ? "inactive" : "active"} />
                        <button type="submit" className="secondary">
                          {a.status === "active" ? "ปิดใช้งาน" : "เปิดใช้งาน"}
                        </button>
                      </form>
                      <form
                        action={(fd) => {
                          if (!confirm(`ยืนยันลบบัญชี "${a.name}"?`)) return;
                          startTransition(async () => {
                            const result = await deleteAccount(fd);
                            if (result?.error) alert(result.error);
                            else onSaved("ลบบัญชีแล้ว");
                          });
                        }}
                      >
                        <input type="hidden" name="accountId" value={a.id} />
                        <button type="submit" className="danger" disabled={!canDelete} title={canDelete ? "" : "ลบไม่ได้ ยอดคงเหลือต้องเป็น 0"}>
                          ลบ
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {accounts.length === 0 && <p className="empty">ยังไม่มีบัญชี</p>}
      </div>
    </div>
  );
}

export function DailyBillModal({
  rooms,
  tenants,
  accounts,
  onClose,
  onSaved,
  prefill,
}: {
  rooms: Pick<Room, "id" | "roomNumber" | "dailyPrice" | "dailyDeposit">[];
  tenants: Pick<Tenant, "id" | "name">[];
  accounts: Account[];
  onClose: () => void;
  onSaved: (msg: string) => void;
  /** เปิดจากปุ่ม "ชำระเงิน" ที่หน้าห้องพัก — ล็อคห้อง/ผู้เช่าไว้ไม่ให้แก้ */
  prefill?: { roomId: number; tenantId: number; checkinDate: string };
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [roomId, setRoomId] = useState<number | "">(prefill?.roomId ?? "");
  const [nights, setNights] = useState(1);
  const [method, setMethod] = useState("cash");
  const room = rooms.find((r) => r.id === roomId);
  const total = room?.dailyPrice ? room.dailyPrice * nights : 0;
  const deposit = room?.dailyDeposit ?? 0;
  const prefillTenant = prefill ? tenants.find((t) => t.id === prefill.tenantId) : undefined;

  function submit(formData: FormData) {
    setError(null);
    formData.set("mode", mode);
    startTransition(async () => {
      const result = await issueDailyBill(formData);
      if (result?.error) setError(result.error);
      else {
        onSaved("ออกบิลรายวันแล้ว — จ่ายครบทันที");
        onClose();
      }
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>ออกบิลรายวัน</h2>
        </div>
        <form action={submit}>
          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}
            <div className="field">
              <label>ห้อง *</label>
              {prefill ? (
                <>
                  <input type="text" disabled value={room ? `${room.roomNumber} (฿${room.dailyPrice?.toLocaleString()}/คืน)` : ""} />
                  <input type="hidden" name="roomId" value={roomId} />
                </>
              ) : (
                <select name="roomId" required value={roomId} onChange={(e) => setRoomId(Number(e.target.value))}>
                  <option value="">-- เลือกห้อง --</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.roomNumber} (฿{r.dailyPrice?.toLocaleString()}/คืน)
                    </option>
                  ))}
                </select>
              )}
            </div>

            {prefill ? (
              <div className="field">
                <label>ผู้เช่า</label>
                <input type="text" disabled value={prefillTenant?.name ?? ""} />
                <input type="hidden" name="tenantId" value={prefill.tenantId} />
              </div>
            ) : (
              <>
                <div className="tabs" style={{ marginBottom: 0 }}>
                  <button type="button" className={`tab${mode === "existing" ? " active" : ""}`} onClick={() => setMode("existing")}>
                    เลือกผู้เช่าเดิม
                  </button>
                  <button type="button" className={`tab${mode === "new" ? " active" : ""}`} onClick={() => setMode("new")}>
                    สร้างผู้เช่าใหม่
                  </button>
                </div>

                {mode === "existing" ? (
                  <div className="field">
                    <label>ผู้เช่า *</label>
                    <select name="tenantId" defaultValue="">
                      <option value="">-- เลือก --</option>
                      {tenants.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="form-row">
                    <div className="field">
                      <label>ชื่อ-นามสกุล *</label>
                      <input name="name" />
                    </div>
                    <div className="field">
                      <label>เบอร์โทร</label>
                      <input name="phone" />
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="form-row">
              <div className="field">
                <label>วันเข้าพัก *</label>
                <input name="checkinDate" type="date" required defaultValue={prefill?.checkinDate ?? new Date().toISOString().slice(0, 10)} />
              </div>
              <div className="field">
                <label>จำนวนคืน *</label>
                <input name="nights" type="number" min={1} required value={nights} onChange={(e) => setNights(Number(e.target.value) || 1)} />
              </div>
            </div>

            <p>
              ยอดรวม ฿{total.toLocaleString()} {deposit > 0 && `+ มัดจำ ฿${deposit.toLocaleString()}`}
            </p>

            <div className="form-row">
              <div className="field">
                <label>วิธีชำระ</label>
                <select name="method" value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option value="cash">เงินสด</option>
                  <option value="transfer">โอนเงิน</option>
                  <option value="credit_card">บัตรเครดิต</option>
                </select>
              </div>
              {method === "transfer" && (
                <div className="field">
                  <label>เวลาที่โอน</label>
                  <input name="transferTime" type="time" defaultValue={new Date().toTimeString().slice(0, 5)} />
                </div>
              )}
              <div className="field">
                <label>บัญชีที่รับเงินเข้า *</label>
                <select name="accountId" required defaultValue="">
                  <option value="">-- เลือกบัญชี --</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="secondary" onClick={onClose}>
              ยกเลิก
            </button>
            <button type="submit" disabled={pending}>
              {pending ? "กำลังบันทึก..." : "ยืนยัน — จ่ายครบทันที"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
