"use client";

import { useState, type ReactElement } from "react";
import { usePathname } from "next/navigation";
import { ChevronDownIcon } from "./icons";

type NavLink = { href: string; label: string; icon: ReactElement };
type NavGroup = { label: string; href?: string; icon: ReactElement; items: NavLink[] };
type NavEntry = ({ kind: "link" } & NavLink) | ({ kind: "group" } & NavGroup);

export default function SidebarNav({ entries }: { entries: NavEntry[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  function toggle(label: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <nav>
      {entries.map((entry) => {
        if (entry.kind === "link") {
          return (
            <a
              key={entry.href}
              href={entry.href}
              className={`nav-link${isActive(entry.href) ? " active" : ""}`}
            >
              <span className="nav-icon">{entry.icon}</span>
              {entry.label}
            </a>
          );
        }

        const isOpen = !collapsed.has(entry.label);

        return (
          <div key={entry.label} className="nav-group">
            <div className="nav-group-title-row">
              {entry.href ? (
                <a
                  href={entry.href}
                  className={`nav-group-title nav-group-title-link${
                    isActive(entry.href) ? " active" : ""
                  }`}
                >
                  <span className="nav-icon">{entry.icon}</span>
                  {entry.label}
                </a>
              ) : (
                <div className="nav-group-title">
                  <span className="nav-icon">{entry.icon}</span>
                  {entry.label}
                </div>
              )}
              <button
                type="button"
                className="nav-group-toggle"
                onClick={() => toggle(entry.label)}
                aria-label={isOpen ? "ย่อเมนู" : "ขยายเมนู"}
              >
                <span style={{ transform: isOpen ? "rotate(0deg)" : "rotate(-90deg)", display: "inline-flex" }}>
                  <ChevronDownIcon size={16} />
                </span>
              </button>
            </div>
            {isOpen &&
              entry.items.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  className={`nav-link nav-subitem${isActive(item.href) ? " active" : ""}`}
                >
                  <span className="nav-icon">{item.icon}</span>
                  {item.label}
                </a>
              ))}
          </div>
        );
      })}
    </nav>
  );
}
