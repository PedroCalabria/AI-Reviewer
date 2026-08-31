"use client";

import { Button } from "@/components/ds/Button";
import { SectionHeading } from "@/components/ds/SectionHeading";
import { ToneCards } from "@/components/app/ToneCards";
import { ACCOUNT, GUARDRAILS, SYNC_COPY } from "@/lib/data";
import { toneFor, useDesk } from "@/lib/store";

export default function SettingsPage() {
  const { state, setTone, setAutoApprove, syncNow } = useDesk();
  const tone = toneFor(state.tone);

  return (
    <div
      style={{
        maxWidth: 820,
        width: "100%",
        padding: "var(--space-12) var(--space-10) var(--section-y)",
        minWidth: 0,
      }}
    >
      <h1
        style={{
          margin: "0 0 var(--space-12)",
          font: "var(--type-section-title)",
          fontSize: "clamp(26px, 3vw, var(--size-h2))",
          letterSpacing: "var(--tracking-tight)",
        }}
      >
        Settings
      </h1>

      <section style={{ marginBottom: "var(--space-16)" }}>
        <SectionHeading variant="label" title="Brand voice" />
        <div style={{ marginTop: "var(--space-6)" }}>
          <ToneCards
            selected={state.tone}
            onSelect={setTone}
            minColumn={240}
          />
        </div>
        <div
          style={{
            marginTop: "var(--space-6)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-card)",
            padding: "var(--space-6)",
          }}
        >
          <div
            style={{
              font: "var(--type-label)",
              color: "var(--text-muted)",
              letterSpacing: "var(--tracking-snug)",
            }}
          >
            Live preview
          </div>
          <div style={{ marginTop: "var(--space-4)", font: "var(--type-body)" }}>
            {tone.example}
          </div>
        </div>
      </section>

      <section style={{ marginBottom: "var(--space-16)" }}>
        <SectionHeading variant="label" title="Auto-approve" />
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "var(--space-6)",
            flexWrap: "wrap",
            marginTop: "var(--space-6)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-card)",
            padding: "var(--space-6)",
          }}
        >
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <div
              id="auto-approve-label"
              style={{
                font: "var(--type-post-title)",
                letterSpacing: "var(--tracking-snug)",
              }}
            >
              Auto-approve template replies for five-star reviews with no text
            </div>
            <div
              style={{
                marginTop: "var(--space-3)",
                font: "var(--type-body-sm)",
                color: "var(--text-muted)",
                maxWidth: "52em",
              }}
            >
              Only applies to ratings with no written text. AI drafts and
              anything escalated always wait for you.
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={state.autoApprove}
            aria-labelledby="auto-approve-label"
            onClick={() => setAutoApprove(!state.autoApprove)}
            style={{
              flex: "none",
              position: "relative",
              width: 48,
              height: 28,
              borderRadius: "var(--radius-control)",
              border: `1px solid ${state.autoApprove ? "var(--ink-1000)" : "var(--border-strong)"}`,
              background: state.autoApprove ? "var(--ink-1000)" : "transparent",
              cursor: "pointer",
              padding: 0,
              transition: "var(--transition-control)",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 3,
                left: state.autoApprove ? 23 : 3,
                width: 20,
                height: 20,
                borderRadius: "var(--radius-circle)",
                background: state.autoApprove
                  ? "var(--ink-000)"
                  : "var(--ink-600)",
                transition:
                  "left var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out)",
              }}
            />
          </button>
        </div>
      </section>

      <section style={{ marginBottom: "var(--space-16)" }}>
        <SectionHeading variant="label" title="Guardrails" />
        <div
          style={{
            marginTop: "var(--space-6)",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          {GUARDRAILS.map((rule) => (
            <div
              key={rule.code}
              style={{
                padding: "var(--space-6) 0",
                borderBottom: "1px solid var(--border-subtle)",
                display: "flex",
                flexWrap: "wrap",
                gap: "var(--space-6)",
                alignItems: "baseline",
              }}
            >
              <div
                style={{
                  flex: "1 1 300px",
                  minWidth: 0,
                  font: "var(--type-post-title)",
                  letterSpacing: "var(--tracking-snug)",
                }}
              >
                {rule.text}
              </div>
              <div
                style={{
                  flex: "1 1 260px",
                  minWidth: 0,
                  font: "var(--type-body-sm)",
                  color: "var(--text-muted)",
                }}
              >
                Blocked: &ldquo;{rule.example}&rdquo;
              </div>
            </div>
          ))}
        </div>
        <div
          style={{
            marginTop: "var(--space-5)",
            font: "var(--type-meta)",
            color: "var(--text-faint)",
          }}
        >
          Read-only · contact us to customize
        </div>
      </section>

      <section style={{ marginBottom: "var(--space-16)" }}>
        <SectionHeading variant="label" title="Connected account" />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
            flexWrap: "wrap",
            marginTop: "var(--space-6)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-card)",
            padding: "var(--space-6)",
          }}
        >
          <span
            style={{
              flex: "none",
              width: 40,
              height: 40,
              borderRadius: "var(--radius-circle)",
              background: "var(--surface-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              font: "var(--type-label)",
            }}
          >
            {ACCOUNT.initials}
          </span>
          <div>
            <div
              style={{
                font: "var(--type-post-title)",
                letterSpacing: "var(--tracking-snug)",
              }}
            >
              {ACCOUNT.email}
            </div>
            <div
              style={{
                marginTop: 2,
                font: "var(--type-meta)",
                color: "var(--text-muted)",
              }}
            >
              Connected {ACCOUNT.connectedOn}
            </div>
          </div>
          <span style={{ marginLeft: "auto" }}>
            <Button variant="outline" size="sm" href="/signin">
              Disconnect
            </Button>
          </span>
        </div>
      </section>

      <section>
        <SectionHeading variant="label" title="Sync" />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
            flexWrap: "wrap",
            marginTop: "var(--space-6)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-card)",
            padding: "var(--space-6)",
          }}
        >
          <div>
            <div
              style={{
                font: "var(--type-post-title)",
                letterSpacing: "var(--tracking-snug)",
              }}
            >
              {SYNC_COPY.cadence}
            </div>
            <div
              style={{
                marginTop: 2,
                font: "var(--type-meta)",
                color: "var(--text-muted)",
              }}
            >
              Last sync 14 minutes ago · next at 15:00
            </div>
          </div>
          <span style={{ marginLeft: "auto" }}>
            <Button variant="outline" size="sm" onClick={syncNow}>
              {state.syncing ? "Syncing" : "Sync now"}
            </Button>
          </span>
        </div>
      </section>
    </div>
  );
}
