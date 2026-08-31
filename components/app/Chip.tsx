"use client";

import type { ReactNode } from "react";

export type ChipProps = {
  children: ReactNode;
  selected: boolean;
  onClick: () => void;
  /** Filter rails use the stronger hairline; the screen rail uses the subtle one. */
  borderTone?: "strong" | "subtle";
};

/** The one pill control behind every filter rail in the desk. */
export function Chip({
  children,
  selected,
  onClick,
  borderTone = "strong",
}: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      style={{
        borderRadius: "var(--radius-control)",
        padding: "8px 16px",
        font: "var(--type-label)",
        letterSpacing: "var(--tracking-snug)",
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "var(--transition-control)",
        background: selected ? "var(--ink-1000)" : "transparent",
        color: selected ? "var(--ink-000)" : "var(--text-muted)",
        border: `1px solid ${
          selected
            ? "var(--ink-1000)"
            : borderTone === "strong"
              ? "var(--border-strong)"
              : "var(--border-subtle)"
        }`,
      }}
    >
      {children}
    </button>
  );
}
