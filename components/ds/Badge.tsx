"use client";

import type { CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

const TONE = {
  light: {
    bg: "var(--surface-pill)",
    fg: "var(--ink-1000)",
    glyph: "dark",
    shadow: "var(--shadow-pill)",
  },
  dark: {
    bg: "var(--ink-1000)",
    fg: "var(--ink-000)",
    glyph: "light",
    shadow: "none",
  },
  scrim: {
    bg: "var(--alpha-black-60)",
    fg: "var(--ink-000)",
    glyph: "light",
    shadow: "none",
  },
} as const;

export type BadgeProps = {
  children?: ReactNode;
  icon?: IconName;
  variant?: keyof typeof TONE;
  size?: "sm" | "md";
  style?: CSSProperties;
};

/** Category / status pill. Sits on the black band (light) or on white (dark). */
export function Badge({
  children,
  icon,
  variant = "light",
  size = "md",
  style,
}: BadgeProps) {
  const tone = TONE[variant] ?? TONE.light;
  const small = size === "sm";

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "var(--gap-inline)",
        padding: small ? "5px 11px" : "7px 14px",
        borderRadius: "var(--radius-control)",
        background: tone.bg,
        color: tone.fg,
        boxShadow: tone.shadow,
        font: "var(--type-label)",
        fontSize: small ? "var(--size-caption)" : "var(--size-body-sm)",
        letterSpacing: "var(--tracking-snug)",
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {icon ? (
        <Icon name={icon} size={small ? 12 : 14} tone={tone.glyph} />
      ) : null}
      {children}
    </span>
  );
}
