import type { CSSProperties, ReactNode } from "react";

export type SectionHeadingProps = {
  title: string;
  action?: ReactNode;
  variant?: "title" | "label";
  as?: "h1" | "h2" | "h3" | "h4";
  style?: CSSProperties;
};

/**
 * Two shapes of section header used across the template:
 *  - "title" : big bold heading on the left, optional pill action on the right
 *  - "label" : small bold label with a hairline rule filling the remaining width
 */
export function SectionHeading({
  title,
  action,
  variant = "title",
  as: Tag = "h2",
  style,
}: SectionHeadingProps) {
  if (variant === "label") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-6)",
          ...style,
        }}
      >
        <span
          style={{
            font: "var(--type-label)",
            letterSpacing: "var(--tracking-snug)",
            color: "var(--text-primary)",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </span>
        <span
          style={{ flex: 1, height: 1, background: "var(--border-subtle)" }}
        />
        {action}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-6)",
        ...style,
      }}
    >
      <Tag
        style={{
          font: "var(--type-section-title)",
          letterSpacing: "var(--tracking-tight)",
          color: "var(--text-primary)",
          margin: 0,
        }}
      >
        {title}
      </Tag>
      {action}
    </div>
  );
}
