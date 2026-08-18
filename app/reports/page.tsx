import { requireAccess } from "@/lib/auth";
import { ReportIcon } from "../icons";

const CATEGORIES = [
  {
    label: "การเงิน",
    reports: [
      { slug: "revenue-expense", name: "สรุปรายรับ-รายจ่าย" },
      { slug: "receivables-aging", name: "สรุปห้องค้างชำระ" },
      { slug: "by-account", name: "สรุปยอดตามบัญชีที่รับเงิน" },
      { slug: "cash-transfer", name: "สรุปเงินสด-โอน" },
      { slug: "vat-wht", name: "สรุปภาษีซื้อ-ขาย (VAT/หัก ณ ที่จ่าย)" },
      { slug: "by-contact", name: "ยอดซื้อ-ขายตามคู่ค้า" },
    ],
  },
  {
    label: "ห้องพัก",
    reports: [
      { slug: "room-status", name: "สรุปสถานะห้องพัก/ผู้เช่า" },
      { slug: "deposits", name: "รายงานเงินมัดจำ" },
      { slug: "meters", name: "รายงานมิเตอร์น้ำ-ไฟ (เทียบรายเดือน)" },
      { slug: "occupancy-rate", name: "อัตราการเข้าพัก (Occupancy Rate)" },
      { slug: "bookings", name: "รายงานการจอง" },
      { slug: "daily-tenants", name: "รายงานลูกค้ารายวัน" },
    ],
  },
  {
    label: "ซ่อมบำรุง/พัสดุ",
    reports: [
      { slug: "repairs", name: "รายงานแจ้งซ่อม" },
      { slug: "parcels", name: "รายงานพัสดุ" },
      { slug: "maintenance-log", name: "รายงานล้างแอร์/บำรุงรักษาอุปกรณ์ส่วนกลาง" },
    ],
  },
  {
    label: "ผู้เช่า",
    reports: [
      { slug: "tenants", name: "รายชื่อผู้เช่าทั้งหมด" },
      { slug: "contracts-expiring", name: "สัญญาใกล้หมดอายุ" },
      { slug: "turnover", name: "อัตราการเข้า-ออกผู้เช่า (Turnover)" },
    ],
  },
];

export default async function ReportsPage() {
  const { building } = await requireAccess("report");

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-header-title">
            <ReportIcon size={24} /> รายงาน
          </div>
          <p className="page-header-subtitle">สรุป/วิเคราะห์/export ข้อมูลของ {building.name}</p>
        </div>
      </div>

      {CATEGORIES.map((cat) => (
        <div key={cat.label} className="card">
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>{cat.label}</h2>
          <ul style={{ listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {cat.reports.map((r) => (
              <li key={r.slug}>
                <a href={`/reports/${r.slug}`} style={{ color: "var(--primary)" }}>
                  • {r.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
