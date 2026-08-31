"use client";

import Link from "next/link";
import { useState, type CSSProperties, type ReactNode } from "react";

const PAD = {
  sm: "9px 18px",
  md: "13px 26px",
  lg: "16px 32px",
} as const;

const TONE = {
  primary: {
    bg: "var(--ink-1000)",
    fg: "var(--ink-000)",
    bd: "transparent",
    hoverBg: "var(--ink-800)",
  },
  inverse: {
    bg: "var(--ink-000)",
    fg: "var(--ink-1000)",
    bd: "transparent",
    hoverBg: "var(--ink-100)",
  },
  outline: {
    bg: "transparent",
    fg: "var(--ink-1000)",
    bd: "var(--border-strong)",
    hoverBg: "var(--ink-1000)",
    hoverFg: "var(--ink-000)",
    hoverBd: "var(--ink-1000)",
  },
  ghost: {
    bg: "transparent",
    fg: "var(--ink-1000)",
    bd: "transparent",
    hoverBg: "var(--ink-100)",
  },
} as const;

export type ButtonVariant = keyof typeof TONE;
export type ButtonSize = keyof typeof PAD;

export type ButtonProps = {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  href?: string;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
  style?: CSSProperties;
  title?: string;
  "aria-label"?: string;
};

export function Button({
  children,
  variant = "primary",
  size = "md",
  href,
  iconLeft,
  iconRight,
  disabled = false,
  fullWidth = false,
  onClick,
  style,
  ...rest
}: ButtonProps) {
  const [hover, setHover] = useState(false);
  const [down, setDown] = useState(false);
  const tone = TONE[variant] ?? TONE.primary;
  const on = hover && !disabled;
  const hoverFg = "hoverFg" in tone ? tone.hoverFg : undefined;
  const hoverBd = "hoverBd" in tone ? tone.hoverBd : undefined;

  const css: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "var(--gap-inline)",
    width: fullWidth ? "100%" : "auto",
    padding: PAD[size],
    border: `1px solid ${on && hoverBd ? hoverBd : tone.bd}`,
    borderRadius: "var(--radius-control)",
    background: on ? tone.hoverBg : tone.bg,
    color: on && hoverFg ? hoverFg : tone.fg,
    font: "var(--type-label)",
    letterSpacing: "var(--tracking-snug)",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.38 : 1,
    transform: down && !disabled ? "scale(var(--press-scale))" : "none",
    transition:
      "var(--transition-control), transform var(--dur-fast) var(--ease-out)",
    textDecoration: "none",
    whiteSpace: "nowrap",
    ...style,
  };

  const handlers = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => {
      setHover(false);
      setDown(false);
    },
    onMouseDown: () => setDown(true),
    onMouseUp: () => setDown(false),
  };

  const body = (
    <>
      {iconLeft}
      {children}
      {iconRight}
    </>
  );

  if (href && !disabled) {
    return (
      <Link href={href} style={css} onClick={onClick} {...handlers} {...rest}>
        {body}
      </Link>
    );
  }

  return (
    <button
      type="button"
      style={css}
      disabled={disabled}
      onClick={onClick}
      {...handlers}
      {...rest}
    >
      {body}
    </button>
  );
}
