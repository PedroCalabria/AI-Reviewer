"use client";

import { Chip } from "@/components/app/Chip";
import { LOG_FILTERS } from "@/lib/data";
import { useDesk } from "@/lib/store";

function actorStyle(type: string) {
  const base = {
    font: "var(--type-meta)",
    whiteSpace: "nowrap" as const,
    borderRadius: "var(--radius-control)",
    padding: "3px 11px",
  };
  if (type === "Escalation") {
    return {
      ...base,
      background: "var(--surface-inverse)",
      color: "var(--text-on-dark)",
    };
  }
  if (type === "You") {
    return {
      ...base,
      border: "1px solid var(--border-focus)",
      color: "var(--text-primary)",
    };
  }
  return {
    ...base,
    border: "1px solid var(--border-subtle)",
    color: "var(--text-muted)",
  };
}

export default function ActivityPage() {
  const { state, visibleLog, setLogFilter } = useDesk();

  return (
    <div
      style={{
        maxWidth: 900,
        width: "100%",
        padding: "var(--space-12) var(--space-10) var(--section-y)",
        minWidth: 0,
      }}
    >
      <h1
        style={{
          margin: "0 0 var(--space-4)",
          font: "var(--type-section-title)",
          fontSize: "clamp(26px, 3vw, var(--size-h2))",
          letterSpacing: "var(--tracking-tight)",
        }}
      >
        Activity log
      </h1>
      <p
        style={{
          margin: "0 0 var(--space-8)",
          maxWidth: "56em",
          font: "var(--type-body)",
          color: "var(--text-muted)",
        }}
      >
        Every sync, draft, guardrail rewrite, and publish, in order. Nothing
        reaches your profile without an entry here.
      </p>

      <div
        style={{
          display: "flex",
          gap: "var(--space-2)",
          flexWrap: "wrap",
          marginBottom: "var(--space-8)",
        }}
      >
        {LOG_FILTERS.map((filter) => (
          <Chip
            key={filter}
            selected={state.logFilter === filter}
            onClick={() => setLogFilter(filter)}
          >
            {filter}
          </Chip>
        ))}
      </div>

      <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
        {visibleLog.map((entry, i) => (
          <div
            key={`${entry.time}-${entry.text}-${i}`}
            style={{
              display: "grid",
              gridTemplateColumns: "auto auto minmax(0, 1fr)",
              gap: "var(--space-6)",
              alignItems: "baseline",
              padding: "var(--space-5) 0",
              borderBottom: "1px solid var(--border-subtle)",
            }}
          >
            <span
              style={{
                font: "var(--type-meta)",
                color: "var(--text-faint)",
                whiteSpace: "nowrap",
              }}
            >
              {entry.time}
            </span>
            <span style={actorStyle(entry.type)}>{entry.actor}</span>
            <span style={{ font: "var(--type-body-sm)" }}>{entry.text}</span>
          </div>
        ))}
      </div>

      {visibleLog.length === 0 ? (
        <div
          style={{
            padding: "var(--space-16) 0",
            textAlign: "center",
            font: "var(--type-body)",
            color: "var(--text-muted)",
          }}
        >
          No entries of this type yet.
        </div>
      ) : null}
    </div>
  );
}
