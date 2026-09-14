"use client";

import { useState } from "react";
import { Button } from "@/components/ds/Button";
import { Input } from "@/components/ds/Input";
import { SectionHeading } from "@/components/ds/SectionHeading";
import { ToneCards } from "@/components/app/ToneCards";
import { signOutAction } from "@/lib/auth-actions";
import { GUARDRAILS } from "@/lib/data";
import { useDesk } from "@/lib/store";
import { toneFor } from "@/lib/config/voice";

const CARD = {
  border: "1px solid var(--border-subtle)",
  borderRadius: "var(--radius-card)",
  padding: "var(--space-6)",
} as const;

export default function SettingsPage() {
  const { data, state, setTone, saveVoiceDetails, syncNow } = useDesk();
  const tone = toneFor(state.tone);

  const [alwaysMention, setAlwaysMention] = useState(data.alwaysMention);
  const [contactEmail, setContactEmail] = useState(data.contactEmail);

  // Re-seed the fields when the server sends new values, so a save made
  // elsewhere does not leave this form showing stale text. Adjusted during
  // render rather than in an effect: React re-runs this component immediately
  // with the new state and never commits the stale pass to the DOM.
  const [seeded, setSeeded] = useState({
    alwaysMention: data.alwaysMention,
    contactEmail: data.contactEmail,
  });
  if (
    seeded.alwaysMention !== data.alwaysMention ||
    seeded.contactEmail !== data.contactEmail
  ) {
    setSeeded({
      alwaysMention: data.alwaysMention,
      contactEmail: data.contactEmail,
    });
    setAlwaysMention(data.alwaysMention);
    setContactEmail(data.contactEmail);
  }

  const dirty =
    alwaysMention !== data.alwaysMention || contactEmail !== data.contactEmail;

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
          <ToneCards selected={state.tone} onSelect={setTone} minColumn={240} />
        </div>
        <div style={{ ...CARD, marginTop: "var(--space-6)" }}>
          <div
            style={{
              font: "var(--type-label)",
              color: "var(--text-muted)",
              letterSpacing: "var(--tracking-snug)",
            }}
          >
            Example reply in this voice
          </div>
          <div style={{ marginTop: "var(--space-4)", font: "var(--type-body)" }}>
            {tone.example}
          </div>
          <div
            style={{
              marginTop: "var(--space-5)",
              font: "var(--type-meta)",
              color: "var(--text-faint)",
            }}
          >
            A fixed example, not a live generation — previewing every voice
            change would spend your daily AI budget on a sentence nobody sends.
          </div>
        </div>
      </section>

      <section style={{ marginBottom: "var(--space-16)" }}>
        <SectionHeading variant="label" title="What every reply should carry" />
        <div
          style={{
            ...CARD,
            marginTop: "var(--space-6)",
            display: "grid",
            gap: "var(--space-6)",
          }}
        >
          <label style={{ display: "block" }}>
            <span
              style={{
                display: "block",
                font: "var(--type-label)",
                letterSpacing: "var(--tracking-snug)",
                marginBottom: "var(--space-3)",
              }}
            >
              Anything we should always mention?
            </span>
            <Input
              placeholder="Family-owned since 1998"
              value={alwaysMention}
              onChange={(e) => setAlwaysMention(e.target.value)}
            />
          </label>

          <label style={{ display: "block" }}>
            <span
              style={{
                display: "block",
                font: "var(--type-label)",
                letterSpacing: "var(--tracking-snug)",
                marginBottom: "var(--space-3)",
              }}
            >
              Where should we send unhappy customers?
            </span>
            <Input
              icon="mail"
              type="email"
              placeholder="hello@cornertable.com"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
            />
            <span
              style={{
                display: "block",
                marginTop: "var(--space-3)",
                font: "var(--type-meta)",
                color: "var(--text-faint)",
              }}
            >
              This is what a draft offers instead of the refund the guardrails
              strip out, so it is worth filling in.
            </span>
          </label>

          <div>
            <Button
              variant="primary"
              size="sm"
              disabled={!dirty}
              onClick={() => saveVoiceDetails(alwaysMention, contactEmail)}
            >
              {dirty ? "Save changes" : "Saved"}
            </Button>
          </div>
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
          Checked on every generated reply, including regenerations. A draft that
          breaks one is rewritten once and then handed to you. Read-only.
        </div>
      </section>

      <section style={{ marginBottom: "var(--space-16)" }}>
        <SectionHeading variant="label" title="AI usage today" />
        <div
          style={{
            ...CARD,
            marginTop: "var(--space-6)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <div
              style={{
                font: "var(--type-post-title)",
                letterSpacing: "var(--tracking-snug)",
              }}
            >
              {data.ai.configured
                ? `${data.ai.used} of ${data.ai.limit} draft calls used`
                : "No API key configured"}
            </div>
            <div
              style={{
                marginTop: "var(--space-3)",
                font: "var(--type-body-sm)",
                color: "var(--text-muted)",
                maxWidth: "52em",
              }}
            >
              {data.ai.configured
                ? `Resets at ${data.ai.resetsAt}. Template replies and keyword escalations don't count against this, because they never call a model.`
                : "Template replies and keyword escalations still work without one. Reviews that need a written reply wait until a key is set."}
            </div>
          </div>
        </div>
      </section>

      <section style={{ marginBottom: "var(--space-16)" }}>
        <SectionHeading variant="label" title="Connected account" />
        <div
          style={{
            ...CARD,
            marginTop: "var(--space-6)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
            flexWrap: "wrap",
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
            {data.account.initials}
          </span>
          <div>
            <div
              style={{
                font: "var(--type-post-title)",
                letterSpacing: "var(--tracking-snug)",
              }}
            >
              {data.account.email}
            </div>
            <div
              style={{
                marginTop: 2,
                font: "var(--type-meta)",
                color: "var(--text-muted)",
              }}
            >
              {data.account.method} · since {data.account.connectedOn}
            </div>
          </div>
          <span style={{ marginLeft: "auto" }}>
            <form action={signOutAction}>
              <Button variant="outline" size="sm" type="submit">
                Sign out
              </Button>
            </form>
          </span>
        </div>
      </section>

      <section>
        <SectionHeading variant="label" title="Reviews and sync" />
        <div
          style={{
            ...CARD,
            marginTop: "var(--space-6)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ flex: "1 1 320px", minWidth: 0 }}>
            <div
              style={{
                font: "var(--type-post-title)",
                letterSpacing: "var(--tracking-snug)",
              }}
            >
              {data.sync.cadence}
            </div>
            <div
              style={{
                marginTop: 2,
                font: "var(--type-meta)",
                color: "var(--text-muted)",
              }}
            >
              {data.sync.lastSyncedAgo
                ? `Last sync ${data.sync.lastSyncedAgo}`
                : "Never synced"}
            </div>
          </div>
          <span style={{ marginLeft: "auto" }}>
            <Button variant="outline" size="sm" onClick={syncNow}>
              {state.syncing ? "Syncing" : "Sync now"}
            </Button>
          </span>
        </div>

        <div
          style={{
            ...CARD,
            marginTop: "var(--space-4)",
            background: data.sync.publishesForReal
              ? undefined
              : "var(--surface-subtle)",
          }}
        >
          <div
            style={{
              font: "var(--type-label)",
              letterSpacing: "var(--tracking-snug)",
            }}
          >
            Review source · {data.sync.providerName}
          </div>
          <div
            style={{
              marginTop: "var(--space-3)",
              font: "var(--type-body-sm)",
              color: "var(--text-muted)",
              maxWidth: "56em",
            }}
          >
            {data.sync.publishesForReal
              ? "Replies you approve are posted to your Google Business Profile."
              : "These reviews are synthetic, and approving a reply records it here without sending anything to Google. Reading and replying to real reviews needs Business Profile API access — the README explains what that involves and what changes when it arrives."}
          </div>
        </div>
      </section>
    </div>
  );
}
