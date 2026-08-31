"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import { TEMPLATES } from "@/lib/data";
import { useDesk } from "@/lib/store";
import type { Review } from "@/lib/types";

const TONE_CHOICES = [
  "Same tone",
  "Warm",
  "Professional",
  "Concise",
  "Playful",
];

const KEEP_IN_MIND = [
  "No refunds, discounts, or free items.",
  "No admission of fault.",
  "No promise that it won't recur.",
  "No employee or third-party names.",
];

export function ReviewDetail({ id }: { id: string }) {
  const router = useRouter();
  const {
    state,
    reviewById,
    neighbours,
    approve,
    markHandled,
    editDraft,
    regenerate,
    cycleTemplate,
    showToast,
  } = useDesk();

  const [showDiff, setShowDiff] = useState(false);
  const [regenTone, setRegenTone] = useState("Same tone");
  const [writing, setWriting] = useState(false);
  const [ownText, setOwnText] = useState("");
  const [copied, setCopied] = useState(false);

  const review = reviewById(id);

  if (!review) {
    return (
      <div style={{ padding: "var(--space-12) var(--space-10)" }}>
        <h1
          style={{
            margin: "0 0 var(--space-5)",
            font: "var(--type-section-title)",
            fontSize: "var(--size-h3)",
            letterSpacing: "var(--tracking-tight)",
          }}
        >
          That review isn&rsquo;t in this queue.
        </h1>
        <Button variant="outline" size="md" href="/inbox">
          Back to inbox
        </Button>
      </div>
    );
  }

  const { index, prev, next } = neighbours(review.id);
  const done = review.status !== "needs";
  const regenerating = state.regeneratingId === review.id;

  const publish = () => {
    if (writing) editDraft(review.id, ownText);
    approve(review.id);
    router.push("/inbox");
  };

  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          padding: "var(--space-6) var(--space-10)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
          flexWrap: "wrap",
        }}
      >
        <Button variant="ghost" size="sm" href="/inbox">
          Back to inbox
        </Button>
        <span style={{ font: "var(--type-meta)", color: "var(--text-muted)" }}>
          {`Review ${index + 1} of ${state.reviews.length} · ${review.meta}`}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", gap: "var(--space-2)" }}>
          <Button
            variant="outline"
            size="sm"
            disabled={!prev}
            onClick={() => prev && router.push(`/inbox/${prev.id}`)}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!next}
            onClick={() => next && router.push(`/inbox/${next.id}`)}
          >
            Next
          </Button>
        </span>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-start" }}>
        <ReviewPane review={review} />

        <div
          style={{
            flex: "1 1 420px",
            minWidth: 0,
            padding: "var(--space-12) var(--space-10)",
          }}
        >
          {done ? (
            <DonePane review={review} />
          ) : review.lane === "generated" ? (
            <GeneratedPane
              review={review}
              regenerating={regenerating}
              voice={state.tone}
              showDiff={showDiff}
              onToggleDiff={() => setShowDiff((v) => !v)}
              regenTone={regenTone}
              onRegenToneChange={setRegenTone}
              onEdit={(text) => editDraft(review.id, text)}
              onRegenerate={() => regenerate(review.id, regenTone)}
              onPublish={publish}
              onSkip={() => {
                router.push("/inbox");
                showToast(`Skipped ${review.name} — still in the queue`);
              }}
            />
          ) : review.lane === "template" ? (
            <TemplatePane
              review={review}
              onEdit={(text) => editDraft(review.id, text)}
              onCycle={() => cycleTemplate(review.id)}
              onPublish={publish}
              onSkip={() => {
                router.push("/inbox");
                showToast(`Skipped ${review.name} — still in the queue`);
              }}
            />
          ) : (
            <EscalatedPane
              review={review}
              writing={writing}
              ownText={ownText}
              copied={copied}
              onStartWriting={() => setWriting(true)}
              onStopWriting={() => {
                setWriting(false);
                setOwnText("");
              }}
              onOwnTextChange={setOwnText}
              onCopy={() => {
                void navigator.clipboard?.writeText(review.text || "");
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }}
              onMarkHandled={() => {
                markHandled(review.id);
                router.push("/inbox");
              }}
              onPublish={publish}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** Left column: the review itself, with the escalation trigger underlined. */
function ReviewPane({ review }: { review: Review }) {
  const trigger = review.trigger ?? "";
  const at = trigger ? review.text.indexOf(trigger) : -1;

  return (
    <div
      style={{
        flex: "1 1 420px",
        minWidth: 0,
        padding: "var(--space-12) var(--space-10)",
        borderRight: "1px solid var(--border-subtle)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            font: "var(--type-card-title)",
            letterSpacing: "var(--tracking-tight)",
          }}
        >
          {review.stars}
          <span style={{ color: "var(--text-faint)" }}>/5</span>
        </span>
        <span style={{ font: "var(--type-meta)", color: "var(--text-muted)" }}>
          Google Business Profile
        </span>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
          marginTop: "var(--space-6)",
        }}
      >
        <span
          style={{
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
          {review.initial}
        </span>
        <span>
          <span
            style={{
              display: "block",
              font: "var(--type-post-title)",
              letterSpacing: "var(--tracking-snug)",
            }}
          >
            {review.name}
          </span>
          <span
            style={{
              display: "block",
              marginTop: 2,
              font: "var(--type-meta)",
              color: "var(--text-muted)",
            }}
          >
            {review.meta}
          </span>
        </span>
      </div>

      {review.text ? (
        <div
          style={{
            marginTop: "var(--space-10)",
            font: "var(--type-card-title)",
            fontSize: "clamp(22px, 2.4vw, var(--size-h3))",
            letterSpacing: "var(--tracking-tight)",
            maxWidth: "26em",
          }}
        >
          {at >= 0 ? (
            <>
              {review.text.slice(0, at)}
              <span style={{ boxShadow: "inset 0 -2px 0 var(--ink-1000)" }}>
                {trigger}
              </span>
              {review.text.slice(at + trigger.length)}
            </>
          ) : (
            review.text
          )}
        </div>
      ) : (
        <div
          style={{
            marginTop: "var(--space-10)",
            font: "var(--type-card-title)",
            fontSize: "var(--size-h4)",
            color: "var(--text-faint)",
          }}
        >
          No text — a rating only.
        </div>
      )}

      {review.themes.length > 0 ? (
        <div
          style={{
            marginTop: "var(--space-12)",
            paddingTop: "var(--space-6)",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <div
            style={{
              font: "var(--type-label)",
              color: "var(--text-muted)",
              letterSpacing: "var(--tracking-snug)",
            }}
          >
            Themes detected
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-2)",
              marginTop: "var(--space-4)",
            }}
          >
            {review.themes.map((theme) => (
              <span
                key={theme}
                style={{
                  font: "var(--type-meta)",
                  color: "var(--text-muted)",
                  border: "1px solid var(--border-strong)",
                  borderRadius: "var(--radius-control)",
                  padding: "5px 12px",
                }}
              >
                {theme}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function draftBoxStyle(edited: boolean, dimmed: boolean) {
  return {
    marginTop: "var(--space-4)",
    border: `1px solid ${edited ? "var(--border-focus)" : "var(--border-subtle)"}`,
    borderRadius: "var(--radius-card)",
    background: "var(--surface-page)",
    padding: "var(--space-6)",
    transition:
      "border-color var(--dur-fast) var(--ease-out), opacity var(--dur-base) var(--ease-out)",
    opacity: dimmed ? 0.4 : 1,
  } as const;
}

const DRAFT_TEXTAREA = {
  width: "100%",
  border: 0,
  outline: "none",
  background: "transparent",
  resize: "vertical",
  font: "var(--type-body)",
  padding: 0,
} as const;

function GeneratedPane({
  review,
  regenerating,
  voice,
  showDiff,
  onToggleDiff,
  regenTone,
  onRegenToneChange,
  onEdit,
  onRegenerate,
  onPublish,
  onSkip,
}: {
  review: Review;
  regenerating: boolean;
  voice: string;
  showDiff: boolean;
  onToggleDiff: () => void;
  regenTone: string;
  onRegenToneChange: (tone: string) => void;
  onEdit: (text: string) => void;
  onRegenerate: () => void;
  onPublish: () => void;
  onSkip: () => void;
}) {
  const hasAdjust = !!review.adjust && !review.edited;

  return (
    <div>
      <div
        style={{
          font: "var(--type-label)",
          letterSpacing: "var(--tracking-snug)",
          color: review.edited ? "var(--text-primary)" : "var(--text-muted)",
        }}
      >
        {review.edited
          ? "Edited by you"
          : regenerating
            ? "Drafting"
            : "Drafted by AI · 2 minutes ago"}
      </div>

      <div style={draftBoxStyle(review.edited, regenerating)}>
        <label className="sr-only" htmlFor="draft">
          Draft reply
        </label>
        <textarea
          id="draft"
          value={review.draftText}
          onChange={(e) => onEdit(e.target.value)}
          rows={7}
          style={DRAFT_TEXTAREA}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
            marginTop: "var(--space-5)",
            paddingTop: "var(--space-4)",
            borderTop: "1px solid var(--border-subtle)",
            font: "var(--type-meta)",
            color: "var(--text-muted)",
          }}
        >
          <span>{review.draftText.length} characters</span>
          <span style={{ marginLeft: "auto" }}>
            {review.edited ? "Your words" : `${voice} voice`}
          </span>
        </div>
      </div>

      {hasAdjust && review.adjust ? (
        <>
          <div
            style={{
              marginTop: "var(--space-4)",
              background: "var(--surface-subtle)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-4) var(--space-5)",
            }}
          >
            <span
              style={{ font: "var(--type-body-sm)", color: "var(--text-primary)" }}
            >
              {review.adjust.note}{" "}
            </span>
            <button
              type="button"
              onClick={onToggleDiff}
              style={{
                background: "none",
                border: 0,
                padding: 0,
                font: "var(--type-body-sm)",
                color: "var(--text-primary)",
                textDecoration: "underline",
                textUnderlineOffset: 3,
                cursor: "pointer",
              }}
            >
              {showDiff ? "Hide what changed" : "See what changed"}
            </button>
          </div>

          {showDiff ? (
            <div
              style={{
                marginTop: "var(--space-3)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-5)",
              }}
            >
              <div
                style={{
                  font: "var(--type-label)",
                  color: "var(--text-muted)",
                  letterSpacing: "var(--tracking-snug)",
                }}
              >
                Removed · {review.adjust.rule}
              </div>
              <div
                style={{
                  marginTop: "var(--space-3)",
                  font: "var(--type-body-sm)",
                  textDecoration: "line-through",
                  color: "var(--text-muted)",
                }}
              >
                {review.adjust.removed}
              </div>
              <div
                style={{
                  marginTop: "var(--space-6)",
                  font: "var(--type-label)",
                  color: "var(--text-muted)",
                  letterSpacing: "var(--tracking-snug)",
                }}
              >
                Written instead
              </div>
              <div
                style={{ marginTop: "var(--space-3)", font: "var(--type-body-sm)" }}
              >
                {review.adjust.replaced}
              </div>
            </div>
          ) : null}
        </>
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          flexWrap: "wrap",
          marginTop: "var(--space-8)",
        }}
      >
        <Button variant="primary" size="md" onClick={onPublish}>
          Approve and publish
        </Button>
        <Button
          variant="outline"
          size="md"
          onClick={onRegenerate}
          disabled={regenerating}
        >
          {regenerating ? "Regenerating" : "Regenerate"}
        </Button>
        <label>
          <span className="sr-only">Regenerate in tone</span>
          <select
            value={regenTone}
            onChange={(e) => onRegenToneChange(e.target.value)}
            style={{
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius-control)",
              padding: "11px 16px",
              font: "var(--type-label)",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            {TONE_CHOICES.map((tone) => (
              <option key={tone} value={tone}>
                {tone}
              </option>
            ))}
          </select>
        </label>
        <Button variant="ghost" size="md" onClick={onSkip}>
          Skip
        </Button>
      </div>
    </div>
  );
}

function TemplatePane({
  review,
  onEdit,
  onCycle,
  onPublish,
  onSkip,
}: {
  review: Review;
  onEdit: (text: string) => void;
  onCycle: () => void;
  onPublish: () => void;
  onSkip: () => void;
}) {
  return (
    <div>
      <div
        style={{
          font: "var(--type-label)",
          letterSpacing: "var(--tracking-snug)",
          color: review.edited ? "var(--text-primary)" : "var(--text-muted)",
        }}
      >
        {review.edited ? "Edited by you" : "Template reply · no AI used"}
      </div>

      <div style={draftBoxStyle(review.edited, false)}>
        <label className="sr-only" htmlFor="template-draft">
          Template reply
        </label>
        <textarea
          id="template-draft"
          value={review.draftText}
          onChange={(e) => onEdit(e.target.value)}
          rows={4}
          style={DRAFT_TEXTAREA}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
            marginTop: "var(--space-5)",
            paddingTop: "var(--space-4)",
            borderTop: "1px solid var(--border-subtle)",
            font: "var(--type-meta)",
            color: "var(--text-muted)",
          }}
        >
          <span>{`Variant ${review.variant + 1} of ${TEMPLATES.length}`}</span>
          <button
            type="button"
            onClick={onCycle}
            style={{
              marginLeft: "auto",
              background: "none",
              border: 0,
              padding: 0,
              font: "var(--type-meta)",
              color: "var(--text-primary)",
              textDecoration: "underline",
              textUnderlineOffset: 3,
              cursor: "pointer",
            }}
          >
            Next variant
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          flexWrap: "wrap",
          marginTop: "var(--space-8)",
        }}
      >
        <Button variant="outline" size="md" onClick={onPublish}>
          Approve and publish
        </Button>
        <Button variant="ghost" size="md" onClick={onSkip}>
          Skip
        </Button>
      </div>

      <p
        style={{
          margin: "var(--space-6) 0 0",
          maxWidth: "44em",
          font: "var(--type-body-sm)",
          color: "var(--text-muted)",
        }}
      >
        Ratings with no text get a rotating thank-you. No AI runs, so these cost
        nothing and can be cleared in bulk from the inbox.
      </p>
    </div>
  );
}

function EscalatedPane({
  review,
  writing,
  ownText,
  copied,
  onStartWriting,
  onStopWriting,
  onOwnTextChange,
  onCopy,
  onMarkHandled,
  onPublish,
}: {
  review: Review;
  writing: boolean;
  ownText: string;
  copied: boolean;
  onStartWriting: () => void;
  onStopWriting: () => void;
  onOwnTextChange: (text: string) => void;
  onCopy: () => void;
  onMarkHandled: () => void;
  onPublish: () => void;
}) {
  return (
    <div>
      <div
        style={{
          background: "var(--surface-inverse)",
          borderRadius: "var(--radius-band)",
          padding: "var(--space-10)",
        }}
      >
        <Badge variant="light" size="sm">
          Escalated · {review.category}
        </Badge>
        <div
          style={{
            marginTop: "var(--space-6)",
            font: "var(--type-card-title)",
            fontSize: "var(--size-h4)",
            letterSpacing: "var(--tracking-tight)",
            color: "var(--text-on-dark)",
          }}
        >
          We didn&rsquo;t draft a reply.
        </div>
        <div
          style={{
            marginTop: "var(--space-4)",
            font: "var(--type-body-sm)",
            color: "var(--text-on-dark-muted)",
            maxWidth: "46em",
          }}
        >
          {review.escalationCopy}
        </div>
        <div
          style={{
            marginTop: "var(--space-8)",
            paddingTop: "var(--space-6)",
            borderTop: "1px solid var(--border-inverse)",
          }}
        >
          <div
            style={{
              font: "var(--type-label)",
              color: "var(--text-on-dark-muted)",
              letterSpacing: "var(--tracking-snug)",
            }}
          >
            Triggering phrase · {review.rule}
          </div>
          <div
            style={{
              marginTop: "var(--space-4)",
              font: "var(--type-post-title)",
              letterSpacing: "var(--tracking-snug)",
              color: "var(--text-on-dark)",
            }}
          >
            &ldquo;{review.trigger}&rdquo;
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          flexWrap: "wrap",
          marginTop: "var(--space-8)",
        }}
      >
        <Button
          variant="primary"
          size="md"
          onClick={onStartWriting}
          disabled={writing}
        >
          Write reply myself
        </Button>
        <Button variant="outline" size="md" onClick={onMarkHandled}>
          Mark as handled
        </Button>
        <Button variant="ghost" size="md" onClick={onCopy}>
          {copied ? "Copied" : "Copy review"}
        </Button>
      </div>

      {writing ? (
        <div
          style={{
            marginTop: "var(--space-10)",
            paddingTop: "var(--space-8)",
            borderTop: "1px solid var(--border-subtle)",
          }}
        >
          <div
            style={{
              font: "var(--type-label)",
              letterSpacing: "var(--tracking-snug)",
            }}
          >
            Written by you · no AI
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "var(--space-6)",
              marginTop: "var(--space-4)",
              alignItems: "flex-start",
            }}
          >
            <div
              style={{
                flex: "1 1 280px",
                minWidth: 0,
                border: "1px solid var(--border-focus)",
                borderRadius: "var(--radius-card)",
                padding: "var(--space-6)",
              }}
            >
              <label className="sr-only" htmlFor="own-reply">
                Your reply
              </label>
              <textarea
                id="own-reply"
                value={ownText}
                onChange={(e) => onOwnTextChange(e.target.value)}
                rows={8}
                placeholder="Write your reply. Keep it short, don't admit fault, and move the conversation off the review."
                style={DRAFT_TEXTAREA}
              />
            </div>
            <div
              style={{
                flex: "1 1 220px",
                minWidth: 0,
                background: "var(--surface-subtle)",
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
                Keep in mind
              </div>
              <div
                style={{
                  display: "grid",
                  gap: "var(--space-3)",
                  marginTop: "var(--space-4)",
                  font: "var(--type-body-sm)",
                }}
              >
                {KEEP_IN_MIND.map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
              <div
                style={{
                  marginTop: "var(--space-5)",
                  font: "var(--type-body-sm)",
                  color: "var(--text-muted)",
                }}
              >
                We check your reply against these before it publishes.
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              flexWrap: "wrap",
              marginTop: "var(--space-6)",
            }}
          >
            <Button
              variant="primary"
              size="md"
              onClick={onPublish}
              disabled={!ownText.trim()}
            >
              Publish my reply
            </Button>
            <Button variant="ghost" size="md" onClick={onStopWriting}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DonePane({ review }: { review: Review }) {
  return (
    <div
      style={{
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-card)",
        padding: "var(--space-8)",
      }}
    >
      <div
        style={{
          font: "var(--type-label)",
          color: "var(--text-muted)",
          letterSpacing: "var(--tracking-snug)",
        }}
      >
        {review.status === "published"
          ? "Published to Google Business Profile"
          : "Approved — publishing on next sync"}
      </div>
      <div
        style={{
          marginTop: "var(--space-5)",
          font: "var(--type-body)",
          maxWidth: "48em",
        }}
      >
        {review.draftText}
      </div>
      <div
        style={{
          marginTop: "var(--space-6)",
          font: "var(--type-meta)",
          color: "var(--text-faint)",
        }}
      >
        By Sarah · today ·{" "}
        {review.edited
          ? "edited before publishing"
          : review.lane === "template"
            ? "template, no AI"
            : "AI draft, unchanged"}
      </div>
    </div>
  );
}
