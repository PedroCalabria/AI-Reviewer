import type { CSSProperties } from "react";

export type MetaLineProps = {
  category?: string;
  date?: string;
  separator?: string;
  tone?: "dark" | "light";
  style?: CSSProperties;
};

/** `Escalated · Sep 1, 2023` — category in ink, separator and date muted. */
export function MetaLine({
  category,
  date,
  separator = "·",
  tone = "dark",
  style,
}: MetaLineProps) {
  const strong = tone === "light" ? "var(--text-on-dark)" : "var(--text-primary)";
  const weak =
    tone === "light" ? "var(--text-on-dark-muted)" : "var(--text-muted)";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        font: "var(--type-meta)",
        letterSpacing: "var(--tracking-snug)",
        ...style,
      }}
    >
      {category ? (
        <span style={{ color: strong, fontWeight: "var(--weight-bold)" }}>
          {category}
        </span>
      ) : null}
      {category && date ? <span style={{ color: weak }}>{separator}</span> : null}
      {date ? (
        <span style={{ color: weak, fontWeight: "var(--weight-medium)" }}>
          {date}
        </span>
      ) : null}
    </div>
  );
}
