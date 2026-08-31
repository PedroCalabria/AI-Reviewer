"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
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
    data,
    state,
    visibleReviews,
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
  const aiPaused = !data.ai.configured || data.ai.exhausted;

  const publish = () => {
    if (writing) editDraft(review.id, ownText);
    approve(review.id);
    router.push("/inbox");
  };

  const skip = () => {
    router.push("/inbox");
    showToast(`Skipped ${review.name} — still in the queue`);
  };

  const writeYourOwnProps = {
    review,
    writing,
    ownText,
    copied,
    onStartWriting: () => setWriting(true),
    onStopWriting: () => {
      setWriting(false);
      setOwnText("");
    },
    onOwnTextChange: setOwnText,
    onCopy: () => {
      void navigator.clipboard?.writeText(review.text || "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    },
    onMarkHandled: () => {
      markHandled(review.id);
      router.push("/inbox");
    },
    onPublish: publish,
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
          {index >= 0
            ? `Review ${index + 1} of ${visibleReviews.length} · ${review.meta}`
            : review.meta}
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
            <DonePane
              review={review}
              actorName={data.account.name || data.account.email}
              publishesForReal={data.sync.publishesForReal}
            />
          ) : review.lane === "generated" ? (
            <GeneratedPane
              review={review}
              regenerating={regenerating}
              voice={state.tone}
              aiPaused={aiPaused}
              showDiff={showDiff}
              onToggleDiff={() => setShowDiff((v) => !v)}
              regenTone={regenTone}
              onRegenToneChange={setRegenTone}
              onEdit={(text) => editDraft(review.id, text)}
              onRegenerate={() => regenerate(review.id, regenTone)}
              onPublish={publish}
              onSkip={skip}
            />
          ) : review.lane === "template" ? (
            <TemplatePane
              review={review}
              onEdit={(text) => editDraft(review.id, text)}
              onCycle={() => cycleTemplate(review.id)}
              onPublish={publish}
              onSkip={skip}
            />
          ) : review.lane === "manual" ? (
            <ManualPane {...writeYourOwnProps} />
          ) : review.lane === "waiting" ? (
            <WaitingPane
              {...writeYourOwnProps}
              configured={data.ai.configured}
              resetsAt={data.ai.resetsAt}
            />
          ) : (
            <EscalatedPane {...writeYourOwnProps} />
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

      {review.language ? (
        <div
          style={{
            marginTop: "var(--space-5)",
            font: "var(--type-meta)",
            color: "var(--text-faint)",
          }}
        >
          Written in {languageName(review.language)}. Replies are drafted in the
          same language.
        </div>
      ) : null}

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

function languageName(tag: string): string {
  try {
    return (
      new Intl.DisplayNames(["en"], { type: "language" }).of(tag) ?? tag
    );
  } catch {
    return tag;
  }
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
  aiPaused,
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
  aiPaused: boolean;
  showDiff: boolean;
  onToggleDiff: () => void;
  regenTone: string;
  onRegenToneChange: (tone: string) => void;
  onEdit: (text: string) => void;
  onRegenerate: () => void;
  onPublish: () => void;
  onSkip: () => void;
}) {
  const adjustments = review.edited ? [] : review.adjustments;

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
            : `Drafted by AI · ${review.draftedAgo ?? "just now"}`}
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

      {adjustments.length > 0 ? (
        <>
          <div
            style={{
              marginTop: "var(--space-4)",
              background: "var(--surface-subtle)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-4) var(--space-5)",
            }}
          >
            {adjustments.map((adjustment, i) => (
              <span
                key={`${adjustment.rule}-${i}`}
                style={{
                  font: "var(--type-body-sm)",
                  color: "var(--text-primary)",
                }}
              >
                {adjustment.note}{" "}
              </span>
            ))}
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
                display: "grid",
                gap: "var(--space-6)",
              }}
            >
              {adjustments.map((adjustment, i) => (
                <div key={`${adjustment.rule}-diff-${i}`}>
                  <div
                    style={{
                      font: "var(--type-label)",
                      color: "var(--text-muted)",
                      letterSpacing: "var(--tracking-snug)",
                    }}
                  >
                    Removed · {adjustment.ruleLabel}
                  </div>
                  <div
                    style={{
                      marginTop: "var(--space-3)",
                      font: "var(--type-body-sm)",
                      textDecoration: "line-through",
                      color: "var(--text-muted)",
                    }}
                  >
                    {adjustment.removed}
                  </div>
                  {adjustment.replaced ? (
                    <>
                      <div
                        style={{
                          marginTop: "var(--space-5)",
                          font: "var(--type-label)",
                          color: "var(--text-muted)",
                          letterSpacing: "var(--tracking-snug)",
                        }}
                      >
                        Written instead
                      </div>
                      <div
                        style={{
                          marginTop: "var(--space-3)",
                          font: "var(--type-body-sm)",
                        }}
                      >
                        {adjustment.replaced}
                      </div>
                    </>
                  ) : (
                    <div
                      style={{
                        marginTop: "var(--space-4)",
                        font: "var(--type-body-sm)",
                        color: "var(--text-muted)",
                      }}
                    >
                      Nothing was written in its place — the sentence was
                      dropped.
                    </div>
                  )}
                </div>
              ))}
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
          disabled={regenerating || aiPaused}
          title={
            aiPaused
              ? "AI drafts are paused. The draft above is unaffected."
              : undefined
          }
        >
          {regenerating ? "Regenerating" : "Regenerate"}
        </Button>
        <label>
          <span className="sr-only">Regenerate in tone</span>
          <select
            value={regenTone}
            onChange={(e) => onRegenToneChange(e.target.value)}
            disabled={aiPaused}
            style={{
              border: "1px solid var(--border-strong)",
              borderRadius: "var(--radius-control)",
              padding: "11px 16px",
              font: "var(--type-label)",
              background: "transparent",
              cursor: aiPaused ? "not-allowed" : "pointer",
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

      <p
        style={{
          margin: "var(--space-6) 0 0",
          maxWidth: "48em",
          font: "var(--type-body-sm)",
          color: "var(--text-muted)",
        }}
      >
        Every regeneration goes through the same guardrails as the first draft.
        Nothing reaches this box unchecked.
      </p>
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
          <span>{`Variant ${review.variant + 1} of ${review.variantCount}`}</span>
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
        Ratings of four stars or more with little or nothing written get a
        rotating thank-you. No AI runs, so these cost nothing and can be cleared
        in bulk from the inbox.
      </p>
    </div>
  );
}

type WriteYourOwnProps = {
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
};

function EscalatedPane(props: WriteYourOwnProps) {
  const { review } = props;

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

        {review.trigger ? (
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
              {review.triggerSource === "keyword"
                ? `Triggering phrase · ${review.category}`
                : `Flagged by the classifier · ${review.category}`}
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
        ) : (
          // No quote to show: the check itself failed, and we escalated rather
          // than guess. Saying so is better than an empty quotation mark.
          <div
            style={{
              marginTop: "var(--space-8)",
              paddingTop: "var(--space-6)",
              borderTop: "1px solid var(--border-inverse)",
              font: "var(--type-body-sm)",
              color: "var(--text-on-dark-muted)",
            }}
          >
            We couldn&rsquo;t finish checking this review automatically, so we
            escalated it rather than draft something we hadn&rsquo;t screened.
          </div>
        )}
      </div>

      <WriteYourOwn {...props} />
    </div>
  );
}

/**
 * The fourth lane: generation ran twice and the validator blocked both.
 *
 * Structurally the escalated slab, because it is the same message — no draft, a
 * person has to write this — but it is not an escalation and must not claim to
 * be one. Nothing about the review is dangerous; our own drafting failed.
 */
function ManualPane(props: WriteYourOwnProps) {
  const { review } = props;
  const [showAttempts, setShowAttempts] = useState(false);

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
          Blocked by guardrails
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
          We couldn&rsquo;t draft this one within the safety rules.
        </div>
        <div
          style={{
            marginTop: "var(--space-4)",
            font: "var(--type-body-sm)",
            color: "var(--text-on-dark-muted)",
            maxWidth: "46em",
          }}
        >
          Two attempts both committed you to something we won&rsquo;t publish on
          your behalf. Rather than soften it a third time and hope, we stopped.
          Write it yourself.
        </div>

        {review.blockedAttempts.length > 0 ? (
          <div
            style={{
              marginTop: "var(--space-8)",
              paddingTop: "var(--space-6)",
              borderTop: "1px solid var(--border-inverse)",
            }}
          >
            <button
              type="button"
              onClick={() => setShowAttempts((v) => !v)}
              style={{
                background: "none",
                border: 0,
                padding: 0,
                font: "var(--type-label)",
                letterSpacing: "var(--tracking-snug)",
                color: "var(--text-on-dark)",
                textDecoration: "underline",
                textUnderlineOffset: 3,
                cursor: "pointer",
              }}
            >
              {showAttempts ? "Hide what we tried" : "See what we tried"}
            </button>

            {showAttempts ? (
              <div style={{ display: "grid", gap: "var(--space-6)", marginTop: "var(--space-6)" }}>
                {review.blockedAttempts.map((attempt) => (
                  <div key={attempt.attempt}>
                    <div
                      style={{
                        font: "var(--type-meta)",
                        color: "var(--text-on-dark-muted)",
                      }}
                    >
                      Attempt {attempt.attempt} · blocked by{" "}
                      {attempt.brokeRules.length
                        ? attempt.brokeRules.join(" and ").toLowerCase()
                        : "the guardrails"}
                    </div>
                    <div
                      style={{
                        marginTop: "var(--space-3)",
                        font: "var(--type-body-sm)",
                        color: "var(--text-on-dark)",
                        textDecoration: "line-through",
                        opacity: 0.75,
                      }}
                    >
                      {attempt.text}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <WriteYourOwn {...props} />
    </div>
  );
}

/** Synced, but the escalation gate could not run, so nothing was drafted. */
function WaitingPane({
  configured,
  resetsAt,
  ...props
}: WriteYourOwnProps & { configured: boolean; resetsAt: string }) {
  return (
    <div>
      <div
        style={{
          border: "1px solid var(--border-strong)",
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
          Not screened yet
        </div>
        <div
          style={{
            marginTop: "var(--space-5)",
            font: "var(--type-post-title)",
            letterSpacing: "var(--tracking-snug)",
          }}
        >
          We haven&rsquo;t checked this review, so we haven&rsquo;t drafted a
          reply for it.
        </div>
        <div
          style={{
            marginTop: "var(--space-4)",
            font: "var(--type-body-sm)",
            color: "var(--text-muted)",
            maxWidth: "48em",
          }}
        >
          {configured
            ? `The daily AI limit was reached before this one came up. It resets at ${resetsAt}, and the next sync will pick it up.`
            : "No Gemini API key is configured, so the escalation check and the drafting step are both off. Add one and sync again, or write the reply yourself below."}
        </div>
      </div>

      <WriteYourOwn {...props} />
    </div>
  );
}

/**
 * The shared "a person writes this one" flow. Used by the escalated, blocked,
 * and unscreened lanes, which differ in why there is no draft but not in what
 * the operator does about it.
 */
function WriteYourOwn({
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
}: WriteYourOwnProps) {
  return (
    <>
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
                These are the rules we hold the AI to. Your own words are yours
                — we publish them as written.
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

          <p
            style={{
              margin: "var(--space-5) 0 0",
              maxWidth: "44em",
              font: "var(--type-meta)",
              color: "var(--text-faint)",
            }}
          >
            Replying to {review.name}.
          </p>
        </div>
      ) : null}
    </>
  );
}

function DonePane({
  review,
  actorName,
  publishesForReal,
}: {
  review: Review;
  actorName: string;
  publishesForReal: boolean;
}) {
  const heading =
    review.status === "handled"
      ? "Handled outside the tool — nothing was published"
      : review.status === "published"
        ? publishesForReal
          ? "Published to Google Business Profile"
          : "Recorded as published · nothing was sent to Google"
        : "Approved — publishing on the next sync";

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
        {heading}
      </div>

      {review.status === "handled" ? (
        <div
          style={{
            marginTop: "var(--space-5)",
            font: "var(--type-body)",
            color: "var(--text-muted)",
            maxWidth: "48em",
          }}
        >
          You marked this one as dealt with elsewhere. No reply from us is on
          the profile.
        </div>
      ) : (
        <div
          style={{
            marginTop: "var(--space-5)",
            font: "var(--type-body)",
            maxWidth: "48em",
          }}
        >
          {review.draftText}
        </div>
      )}

      <div
        style={{
          marginTop: "var(--space-6)",
          font: "var(--type-meta)",
          color: "var(--text-faint)",
        }}
      >
        By {actorName} ·{" "}
        {review.edited
          ? "edited before publishing"
          : review.lane === "template"
            ? "template, no AI"
            : review.lane === "generated"
              ? "AI draft, unchanged"
              : "written by hand"}
      </div>

      {review.status === "published" && !publishesForReal ? (
        <div
          style={{
            marginTop: "var(--space-6)",
            paddingTop: "var(--space-5)",
            borderTop: "1px solid var(--border-subtle)",
            font: "var(--type-body-sm)",
            color: "var(--text-muted)",
            maxWidth: "48em",
          }}
        >
          This profile is synthetic, so the reply was recorded here and nowhere
          else. Connecting a real Google Business Profile is what makes this
          step post publicly — see the README.
        </div>
      ) : null}
    </div>
  );
}
