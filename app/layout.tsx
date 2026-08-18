import "./globals.css";
import type { ReactElement, ReactNode } from "react";
import { getCurrentBuilding, getCurrentUser, hasModuleAccess } from "@/lib/auth";
import { logout } from "./session-actions";
import SidebarNav from "./SidebarNav";
import {
  BuildingIcon,
  CalendarIcon,
  DashboardIcon,
  DoorIcon,
  GaugeIcon,
  HistoryIcon,
  LogoutIcon,
  PackageIcon,
  PersonIcon,
  ReportIcon,
  SettingsIcon,
  TrendUpIcon,
  UsersIcon,
  WalletIcon,
  WrenchIcon,
} from "./icons";

export const metadata = {
  title: "ระบบจัดการหอพัก",
  description: "Dormitory Management System",
};

type NavLink = { href: string; label: string; module: string; icon: ReactElement };
type NavGroup = {
  label: string;
  href?: string;
  module?: string;
  icon: ReactElement;
  items: NavLink[];
};
type NavEntry = ({ kind: "link" } & NavLink) | ({ kind: "group" } & NavGroup);

const navEntries: NavEntry[] = [
  { kind: "link", href: "/", label: "ภาพรวม", module: "dashboard", icon: <DashboardIcon /> },
  {
    kind: "group",
    label: "ห้องพัก",
    icon: <BuildingIcon />,
    items: [
      { href: "/rooms", label: "ห้องพัก", module: "room", icon: <DoorIcon /> },
      { href: "/bookings", label: "จองห้องพัก", module: "room", icon: <CalendarIcon /> },
      { href: "/meters", label: "มิเตอร์น้ำ-ไฟ", module: "room", icon: <GaugeIcon /> },
    ],
  },
  {
    kind: "group",
    label: "ผู้เช่า",
    icon: <PersonIcon />,
    items: [
      { href: "/tenants", label: "รายชื่อผู้เช่า", module: "tenant", icon: <PersonIcon /> },
      { href: "/contracts", label: "เอกสารสัญญา", module: "tenant", icon: <CalendarIcon /> },
    ],
  },
  {
    kind: "group",
    label: "การเงิน",
    icon: <WalletIcon />,
    items: [
      { href: "/bills", label: "บิล/ใบเสร็จ", module: "finance", icon: <WalletIcon /> },
      { href: "/expenses", label: "ค่าใช้จ่าย", module: "finance", icon: <WalletIcon /> },
      { href: "/other-income", label: "รายได้อื่นๆ", module: "finance", icon: <TrendUpIcon /> },
      { href: "/accounting", label: "ฐานข้อมูลบัญชี", module: "finance", icon: <WalletIcon /> },
      { href: "/contacts", label: "ผู้ซื้อและผู้ขาย", module: "finance", icon: <UsersIcon /> },
    ],
  },
  {
    kind: "group",
    label: "ซ่อมบำรุง/พัสดุ",
    icon: <WrenchIcon />,
    items: [
      { href: "/repairs", label: "แจ้งซ่อม", module: "maintenance", icon: <WrenchIcon /> },
      { href: "/parcels", label: "พัสดุ", module: "maintenance", icon: <PackageIcon /> },
    ],
  },
  {
    kind: "group",
    label: "ตั้งค่า",
    icon: <SettingsIcon />,
    items: [
      { href: "/settings/users", label: "ผู้ใช้งาน/สิทธิ์", module: "setting", icon: <PersonIcon /> },
      { href: "/settings/building", label: "ค่าตั้งอาคาร", module: "setting", icon: <BuildingIcon /> },
      { href: "/settings/payee", label: "ข้อมูลผู้รับเงิน", module: "setting", icon: <WalletIcon /> },
      { href: "/settings/contract-clauses", label: "ข้อสัญญา", module: "setting", icon: <CalendarIcon /> },
    ],
  },
  { kind: "link", href: "/reports", label: "รายงาน", module: "report", icon: <ReportIcon /> },
  { kind: "link", href: "/audit", label: "ประวัติการใช้งาน", module: "owner", icon: <HistoryIcon /> },
];

function canSee(user: any, moduleCode: string) {
  if (!user) return false;
  if (moduleCode === "owner") return user.role === "owner";
  if (moduleCode === "dashboard") return true;
  return hasModuleAccess(user, moduleCode);
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();

  const visibleEntries = user
    ? navEntries
        .map((entry) => {
          if (entry.kind === "link") {
            return canSee(user, entry.module) ? entry : null;
          }
          const visibleItems = entry.items.filter((item) => canSee(user, item.module));
          const headerVisible = entry.href ? canSee(user, entry.module || "") : visibleItems.length > 0;
          if (!headerVisible && visibleItems.length === 0) return null;
          return { ...entry, items: visibleItems };
        })
        .filter((entry): entry is NavEntry => entry !== null)
    : [];

  const currentBuilding = user ? await getCurrentBuilding(user) : null;

  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="layout">
          <aside className="sidebar">
            <h1>
              <BuildingIcon size={22} />
              <span>ระบบจัดการหอพัก</span>
            </h1>
            {user && currentBuilding && (
              <a href="/select-building" className="building-switcher" title="สลับอาคาร">
                <BuildingIcon size={16} />
                <span>{currentBuilding.name}</span>
              </a>
            )}
            {user && <SidebarNav entries={visibleEntries} />}
            {user && (
              <div className="sidebar-foot">
                <div style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 8 }}>
                  {user.name} ({user.role === "owner" ? "เจ้าของ" : "พนักงาน"})
                </div>
                <form action={logout}>
                  <button type="submit" className="secondary" style={{ width: "100%" }}>
                    <LogoutIcon size={16} />
                    ออกจากระบบ
                  </button>
                </form>
              </div>
            )}
          </aside>
          <main className="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
