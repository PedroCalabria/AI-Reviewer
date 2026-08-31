"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ds/Button";
import { Chip } from "@/components/app/Chip";
import { ReviewRow } from "@/components/app/ReviewRow";
import { INBOX_FILTERS } from "@/lib/data";
import { useDesk } from "@/lib/store";

export default function InboxPage() {
  const router = useRouter();
  const {
    data,
    state,
    visibleReviews,
    counts,
    needsCount,
    pendingTemplates,
    setFilter,
    setCursor,
    approve,
    approveTemplates,
    syncNow,
  } = useDesk();

  const cursor = Math.min(state.cursor, Math.max(0, visibleReviews.length - 1));

  // J / K move the cursor, A approves, E or Enter opens.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      ) {
        return;
      }
      if (!visibleReviews.length) return;

      const key = (e.key || "").toLowerCase();
      const here = visibleReviews[Math.min(cursor, visibleReviews.length - 1)];

      if (key === "j" || key === "k") {
        e.preventDefault();
        setCursor((c) =>
          Math.max(0, Math.min(visibleReviews.length - 1, c + (key === "j" ? 1 : -1))),
        );
      } else if (key === "a") {
        // Only the lanes that have a draft can be approved from the list.
        if (
          here &&
          (here.lane === "generated" || here.lane === "template") &&
          here.status === "needs"
        ) {
          e.preventDefault();
          approve(here.id);
        }
      } else if (key === "e" || e.key === "Enter") {
        if (here) {
          e.preventDefault();
          router.push(`/inbox/${here.id}`);
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [approve, cursor, router, setCursor, visibleReviews]);

  const showBulk =
    pendingTemplates > 0 &&
    (state.filter === "Needs review" || state.filter === "All");
  const templatePlural = pendingTemplates === 1 ? "reply" : "replies";
  const isEmpty =
    visibleReviews.length === 0 &&
    state.filter !== "Approved" &&
    state.filter !== "Published";

  const waiting = state.reviews.filter((r) => r.lane === "waiting").length;

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ padding: "var(--space-10) var(--space-10) 0" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "var(--space-6)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                font: "var(--type-section-title)",
                fontSize: "clamp(26px, 3vw, var(--size-h2))",
                letterSpacing: "var(--tracking-tight)",
              }}
            >
              {needsCount === 0
                ? "Nothing waiting"
                : `${needsCount} ${needsCount === 1 ? "review needs" : "reviews need"} attention`}
            </h1>
            <div
              style={{
                marginTop: "var(--space-3)",
                font: "var(--type-meta)",
                color: "var(--text-muted)",
              }}
            >
              {data.sync.lastSyncedAgo
                ? `Synced ${data.sync.lastSyncedAgo} · ${data.sync.cadence.toLowerCase()}`
                : "Not synced yet"}
            </div>
          </div>

          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: "var(--space-4)",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{
                font: "var(--type-meta)",
                color: "var(--text-faint)",
                whiteSpace: "nowrap",
              }}
            >
              J K move · A approve · E open
            </span>
            <Button variant="outline" size="sm" onClick={syncNow}>
              {state.syncing ? "Syncing" : "Sync now"}
            </Button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: "var(--space-2)",
            flexWrap: "wrap",
            marginTop: "var(--space-8)",
          }}
        >
          {INBOX_FILTERS.map((filter) => (
            <Chip
              key={filter}
              selected={state.filter === filter}
              onClick={() => setFilter(filter)}
            >
              {filter === "All" ? filter : `${filter} (${counts[filter]})`}
            </Chip>
          ))}
        </div>
      </div>

      <AiNotice
        configured={data.ai.configured}
        exhausted={data.ai.exhausted}
        resetsAt={data.ai.resetsAt}
        waiting={waiting}
      />

      {showBulk ? (
        <div
          style={{
            margin: "var(--space-8) var(--space-10) 0",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-card)",
            padding: "var(--space-5) var(--space-6)",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-6)",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              font: "var(--type-body-sm)",
              color: "var(--text-muted)",
              flex: "1 1 260px",
              minWidth: 0,
            }}
          >
            {`${pendingTemplates} template ${templatePlural} ${
              pendingTemplates === 1 ? "is" : "are"
            } ready — four stars or more, with little or nothing written. No AI used.`}
          </span>
          <Button variant="primary" size="sm" onClick={approveTemplates}>
            {`Approve ${pendingTemplates} ${templatePlural}`}
          </Button>
        </div>
      ) : null}

      <div
        style={{
          padding: "var(--space-8) var(--space-10) var(--section-y)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-2)",
        }}
      >
        {visibleReviews.map((review, i) => (
          <ReviewRow
            key={review.id}
            review={review}
            focused={i === cursor}
            onOpen={() => router.push(`/inbox/${review.id}`)}
            onApprove={() => approve(review.id)}
          />
        ))}

        {isEmpty ? (
          <div style={{ padding: "var(--space-24) 0", textAlign: "center" }}>
            <div
              style={{
                font: "var(--type-section-title)",
                fontSize: "var(--size-h3)",
                letterSpacing: "var(--tracking-tight)",
              }}
            >
              {`Queue clear. ${counts.Published} ${
                counts.Published === 1 ? "reply" : "replies"
              } published.`}
            </div>
            <div
              style={{
                margin: "var(--space-5) auto 0",
                maxWidth: "44ch",
                font: "var(--type-body)",
                color: "var(--text-muted)",
              }}
            >
              Nothing is waiting on you. We&rsquo;ll pull in new reviews on the
              next sync and draft what we safely can.
            </div>
            <div
              style={{
                marginTop: "var(--space-6)",
                font: "var(--type-meta)",
                color: "var(--text-faint)",
              }}
            >
              {data.sync.cadence}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The state the automation is actually in.
 *
 * There are two ways for drafting to stop — no key configured, and the day's
 * budget spent — and both are worth saying out loud, because the alternative is
 * an operator staring at reviews with no draft and no explanation.
 */
function AiNotice({
  configured,
  exhausted,
  resetsAt,
  waiting,
}: {
  configured: boolean;
  exhausted: boolean;
  resetsAt: string;
  waiting: number;
}) {
  if (configured && !exhausted) return null;

  const headline = configured
    ? `AI drafts paused — daily limit reached, resuming at ${resetsAt}`
    : "AI drafts are off — no Gemini API key is configured";

  const detail = configured
    ? "Template replies and keyword escalations are unaffected: neither costs anything."
    : "Template replies and keyword escalations still run, because neither needs a model. Add GOOGLE_GENERATIVE_AI_API_KEY to .env and sync again.";

  return (
    <div
      style={{
        margin: "var(--space-8) var(--space-10) 0",
        background: "var(--surface-inverse)",
        borderRadius: "var(--radius-card)",
        padding: "var(--space-5) var(--space-6)",
      }}
    >
      <div
        style={{
          font: "var(--type-label)",
          letterSpacing: "var(--tracking-snug)",
          color: "var(--text-on-dark)",
        }}
      >
        {headline}
      </div>
      <div
        style={{
          marginTop: "var(--space-3)",
          font: "var(--type-body-sm)",
          color: "var(--text-on-dark-muted)",
          maxWidth: "62em",
        }}
      >
        {detail}
        {waiting > 0
          ? ` ${waiting} ${waiting === 1 ? "review is" : "reviews are"} waiting to be screened and will be picked up by the next sync.`
          : ""}
      </div>
    </div>
  );
}
