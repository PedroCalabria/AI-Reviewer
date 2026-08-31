"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
  const { needsCount, data, setLocationId } = useDesk();

  const location =
    data.locations.find((l) => l.id === data.activeLocationId) ??
    data.locations[0];

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
      <LocationSwitcher
        locations={data.locations}
        activeId={location?.id ?? ""}
        onSelect={setLocationId}
      />

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
          {data.account.initials}
        </span>
        <span
          style={{
            font: "var(--type-meta)",
            color: "var(--text-muted)",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {data.account.email}
        </span>
      </div>
    </div>
  );
}

/**
 * The location block, which is a button when there is more than one location
 * and plain text when there is not. An organization with a single location
 * should not be shown a chooser with one option in it.
 */
function LocationSwitcher({
  locations,
  activeId,
  onSelect,
}: {
  locations: { id: string; name: string; address: string; unanswered: number }[];
  activeId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapper = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!wrapper.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = locations.find((l) => l.id === activeId) ?? locations[0];
  if (!active) return null;

  const single = locations.length < 2;

  const label = (
    <>
      <span
        style={{
          display: "block",
          font: "var(--type-post-title)",
          letterSpacing: "var(--tracking-snug)",
        }}
      >
        {active.name}
      </span>
      <span
        style={{
          display: "block",
          marginTop: 4,
          font: "var(--type-meta)",
          color: "var(--text-muted)",
        }}
      >
        {active.address}
      </span>
    </>
  );

  if (single) {
    return (
      <div style={{ padding: "0 var(--space-3) var(--space-6)" }}>{label}</div>
    );
  }

  return (
    <div
      ref={wrapper}
      style={{ position: "relative", padding: "0 0 var(--space-6)" }}
    >
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          width: "100%",
          textAlign: "left",
          background: "transparent",
          border: "1px solid transparent",
          borderRadius: "var(--radius-control)",
          padding: "var(--space-2) var(--space-3)",
          cursor: "pointer",
          transition: "var(--transition-control)",
          borderColor: open ? "var(--border-strong)" : "transparent",
        }}
      >
        <span style={{ minWidth: 0, flex: 1 }}>{label}</span>
        <span
          aria-hidden
          style={{
            flex: "none",
            font: "var(--type-meta)",
            color: "var(--text-muted)",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform var(--dur-fast) var(--ease-out)",
          }}
        >
          ▾
        </span>
      </button>

      {open ? (
        <div
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 20,
            top: "100%",
            left: 0,
            right: 0,
            marginTop: "calc(var(--space-6) * -1 + var(--space-2))",
            background: "var(--surface-page)",
            border: "1px solid var(--border-strong)",
            borderRadius: "var(--radius-card)",
            boxShadow: "var(--shadow-pop, 0 12px 32px rgba(0,0,0,0.12))",
            overflow: "hidden",
          }}
        >
          {locations.map((option) => {
            const selected = option.id === activeId;
            return (
              <button
                key={option.id}
                type="button"
                role="option"
                aria-selected={selected}
                onClick={() => {
                  setOpen(false);
                  if (!selected) onSelect(option.id);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  border: 0,
                  borderBottom: "1px solid var(--border-subtle)",
                  background: selected
                    ? "var(--surface-subtle)"
                    : "transparent",
                  padding: "var(--space-4) var(--space-4)",
                  cursor: "pointer",
                }}
              >
                <span
                  style={{
                    display: "block",
                    font: "var(--type-label)",
                    letterSpacing: "var(--tracking-snug)",
                  }}
                >
                  {option.name}
                </span>
                <span
                  style={{
                    display: "block",
                    marginTop: 2,
                    font: "var(--type-meta)",
                    color: "var(--text-muted)",
                  }}
                >
                  {option.unanswered} waiting
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
