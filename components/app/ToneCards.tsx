"use client";

import { TONES } from "@/lib/data";
import type { ToneName } from "@/lib/types";

export type ToneCardsProps = {
  selected: ToneName;
  onSelect: (tone: ToneName) => void;
  /** Minimum column width for the auto-fit grid. */
  minColumn?: number;
};

/** The brand-voice picker, shared by onboarding step 3 and settings. */
export function ToneCards({
  selected,
  onSelect,
  minColumn = 260,
}: ToneCardsProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Brand voice"
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${minColumn}px, 1fr))`,
        gap: "var(--space-4)",
      }}
    >
      {TONES.map((tone) => {
        const on = tone.name === selected;
        return (
          <button
            key={tone.name}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onSelect(tone.name)}
            style={{
              display: "block",
              textAlign: "left",
              border: `1px solid ${on ? "var(--border-focus)" : "var(--border-subtle)"}`,
              borderRadius: "var(--radius-card)",
              background: on ? "var(--surface-subtle)" : "transparent",
              padding: "var(--space-5) var(--space-6) var(--space-6)",
              cursor: "pointer",
              transition: "var(--transition-control)",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-3)",
              }}
            >
              <span
                style={{
                  flex: "none",
                  width: 12,
                  height: 12,
                  borderRadius: "var(--radius-circle)",
                  border: `1px solid ${on ? "var(--ink-1000)" : "var(--border-strong)"}`,
                  background: on ? "var(--ink-1000)" : "transparent",
                }}
              />
              <span
                style={{
                  font: "var(--type-post-title)",
                  letterSpacing: "var(--tracking-snug)",
                }}
              >
                {tone.name}
              </span>
            </span>
            <span
              style={{
                display: "block",
                marginTop: "var(--space-3)",
                font: "var(--type-body-sm)",
                color: "var(--text-muted)",
                textAlign: "left",
              }}
            >
              {tone.desc}
            </span>
          </button>
        );
      })}
    </div>
  );
}
