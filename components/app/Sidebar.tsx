"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ACCOUNT, LOCATIONS } from "@/lib/data";
import { useDesk } from "@/lib/store";

const NAV_BASE = {
  display: "flex",
  alignItems: "center",
  gap: "var(--space-3)",
  width: "100%",
  textAlign: "left",
  border: 0,
  borderRadius: "var(--radius-control)",
  padding: "10px 14px",
  font: "var(--type-label)",
  letterSpacing: "var(--tracking-snug)",
  cursor: "pointer",
  transition: "var(--transition-control)",
} as const;

export function Sidebar() {
  const pathname = usePathname();
  const { needsCount, state } = useDesk();
  const location =
    LOCATIONS.find((l) => l.id === state.locationId) ?? LOCATIONS[0];

  const items = [
    {
      href: "/inbox",
      label: "Inbox",
      trailing: needsCount,
      active: pathname.startsWith("/inbox"),
    },
    {
      href: "/activity",
      label: "Activity log",
      active: pathname.startsWith("/activity"),
    },
    {
      href: "/settings",
      label: "Settings",
      active: pathname.startsWith("/settings"),
    },
  ];

  return (
    <div
      style={{
        flex: "0 0 var(--sidebar-width)",
        minWidth: "var(--sidebar-width)",
        borderRight: "1px solid var(--border-subtle)",
        display: "flex",
        flexDirection: "column",
        padding: "var(--space-6) var(--space-4)",
      }}
    >
      <div style={{ padding: "0 var(--space-3) var(--space-6)" }}>
        <div
          style={{
            font: "var(--type-post-title)",
            letterSpacing: "var(--tracking-snug)",
          }}
        >
          {location.name}
        </div>
        <div
          style={{
            marginTop: 4,
            font: "var(--type-meta)",
            color: "var(--text-muted)",
          }}
        >
          {location.address}
        </div>
      </div>

      <nav
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-1)",
        }}
      >
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            style={{
              ...NAV_BASE,
              background: item.active ? "var(--ink-1000)" : "transparent",
              color: item.active ? "var(--ink-000)" : "var(--text-primary)",
            }}
          >
            {item.label}
            {item.trailing !== undefined ? (
              <span style={{ marginLeft: "auto", font: "var(--type-meta)" }}>
                {item.trailing}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      <div
        style={{
          marginTop: "auto",
          paddingTop: "var(--space-6)",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
        }}
      >
        <span
          style={{
            flex: "none",
            width: 32,
            height: 32,
            borderRadius: "var(--radius-circle)",
            background: "var(--surface-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            font: "var(--type-meta)",
          }}
        >
          {ACCOUNT.initials}
        </span>
        <span
          style={{
            font: "var(--type-meta)",
            color: "var(--text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {ACCOUNT.email}
        </span>
      </div>
    </div>
  );
}
