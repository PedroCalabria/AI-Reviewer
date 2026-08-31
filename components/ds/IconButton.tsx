"use client";

import { useState, type CSSProperties } from "react";
import { Icon, type IconName } from "./Icon";

const SIZE = { sm: 32, md: 40, lg: 48 } as const;

const TONE = {
  light: {
    bg: "var(--surface-glass)",
    fg: "dark",
    hoverBg: "var(--ink-1000)",
    hoverFg: "light",
    bd: "transparent",
  },
  dark: {
    bg: "var(--ink-1000)",
    fg: "light",
    hoverBg: "var(--ink-000)",
    hoverFg: "dark",
    bd: "transparent",
  },
  outline: {
    bg: "transparent",
    fg: "dark",
    hoverBg: "var(--ink-100)",
    hoverFg: "dark",
    bd: "var(--border-strong)",
  },
} as const;

export type IconButtonProps = {
  icon?: IconName;
  label: string;
  variant?: keyof typeof TONE;
  size?: keyof typeof SIZE;
  onClick?: () => void;
  elevated?: boolean;
  disabled?: boolean;
  style?: CSSProperties;
};

export function IconButton({
  icon = "arrow-up-right",
  label,
  variant = "light",
  size = "md",
  onClick,
  elevated = true,
  disabled = false,
  style,
}: IconButtonProps) {
  const [hover, setHover] = useState(false);
  const [down, setDown] = useState(false);
  const tone = TONE[variant] ?? TONE.light;
  const px = SIZE[size];
  const on = hover && !disabled;

  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => {
        setHover(false);
        setDown(false);
      }}
      onMouseDown={() => setDown(true)}
      onMouseUp={() => setDown(false)}
      style={{
        width: px,
        height: px,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-circle)",
        border: `1px solid ${tone.bd}`,
        background: on ? tone.hoverBg : tone.bg,
        backdropFilter: variant === "light" ? "var(--blur-glass)" : "none",
        boxShadow:
          elevated && variant === "light" ? "var(--shadow-pill)" : "none",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.38 : 1,
        padding: 0,
        transform: down && !disabled ? "scale(var(--press-scale))" : "none",
        transition:
          "var(--transition-control), transform var(--dur-fast) var(--ease-out)",
        ...style,
      }}
    >
      <Icon
        name={icon}
        size={Math.round(px * 0.42)}
        tone={on ? tone.hoverFg : tone.fg}
      />
    </button>
  );
}
