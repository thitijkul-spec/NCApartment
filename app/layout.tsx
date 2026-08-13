import "./globals.css";
import type { ReactElement, ReactNode } from "react";
import { getCurrentUser, hasModuleAccess } from "@/lib/auth";
import { logout } from "./users/actions";
import SidebarNav from "./SidebarNav";
import {
  BuildingIcon,
  CalendarIcon,
  ClipboardCheckIcon,
  DashboardIcon,
  DoorIcon,
  GaugeIcon,
  LogoutIcon,
  PersonIcon,
  ReportIcon,
  SparklesIcon,
  TrendDownIcon,
  TrendUpIcon,
  UsersIcon,
  WalletIcon,
  WrenchIcon,
} from "./icons";

export const metadata = {
  title: "ระบบจัดการหอพัก",
  description: "Dormitory Management System — Prototype",
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
  { kind: "link", href: "/dashboard", label: "Dashboard", module: "OWNER_ONLY", icon: <DashboardIcon /> },
  {
    kind: "group",
    label: "ห้องพัก",
    icon: <BuildingIcon />,
    items: [
      { href: "/rooms", label: "ห้องพัก", module: "A", icon: <DoorIcon /> },
      { href: "/bookings", label: "จองห้องพัก", module: "A", icon: <CalendarIcon /> },
      { href: "/meters", label: "มิเตอร์น้ำ-ไฟ", module: "C", icon: <GaugeIcon /> },
    ],
  },
  { kind: "link", href: "/customers", label: "ผู้เช่า", module: "F", icon: <PersonIcon /> },
  {
    kind: "group",
    label: "การเงิน",
    icon: <WalletIcon />,
    items: [
      { href: "/bills", label: "รายได้", module: "B", icon: <TrendUpIcon /> },
      { href: "/expenses", label: "รายจ่าย", module: "L", icon: <TrendDownIcon /> },
    ],
  },
  {
    kind: "link",
    href: "/cross-check",
    label: "เช็คยอดประจำวัน",
    module: "M",
    icon: <ClipboardCheckIcon />,
  },
  { kind: "link", href: "/maintenance", label: "แจ้งซ่อม", module: "G", icon: <WrenchIcon /> },
  {
    kind: "link",
    href: "/housekeeping",
    label: "แจ้งทำความสะอาด",
    module: "H",
    icon: <SparklesIcon />,
  },
  { kind: "link", href: "/reports", label: "รายงาน", module: "D", icon: <ReportIcon /> },
  { kind: "link", href: "/users", label: "ผู้ใช้งาน", module: "USERS", icon: <UsersIcon /> },
];

function canSee(user: any, moduleCode: string) {
  if (!user) return false;
  if (moduleCode === "OWNER_ONLY") return user.role === "owner";
  if (moduleCode === "USERS") return user.role === "owner" || user.canManageUsers;
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
            {user && <SidebarNav entries={visibleEntries} />}
            {user && (
              <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.2)" }}>
                <div style={{ color: "#dbe4f7", fontSize: 13, marginBottom: 8 }}>
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
