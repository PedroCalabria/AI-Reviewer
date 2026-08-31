"use client";

import type { CSSProperties } from "react";
import { ArrowUpRight, Mail, type LucideIcon } from "lucide-react";

/**
 * Wrapper around the substituted Lucide glyph set. The source design system
 * pulled Lucide as flat SVGs from a CDN; here the same glyphs come from
 * `lucide-react` so nothing is fetched at runtime.
 */
const GLYPHS = {
  "arrow-up-right": ArrowUpRight,
  mail: Mail,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof GLYPHS;

export type IconProps = {
  name: IconName;
  size?: number;
  tone?: "dark" | "light";
  strokeAlpha?: number;
  style?: CSSProperties;
};

export function Icon({
  name,
  size = 18,
  tone = "dark",
  strokeAlpha = 1,
  style,
}: IconProps) {
  const Glyph = GLYPHS[name];
  return (
    <Glyph
      aria-hidden="true"
      size={size}
      strokeWidth={2}
      style={{
        display: "block",
        flex: "0 0 auto",
        color: tone === "light" ? "var(--ink-000)" : "var(--ink-1000)",
        opacity: strokeAlpha,
        ...style,
      }}
    />
  );
}
