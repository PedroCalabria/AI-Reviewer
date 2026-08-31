"use client";

import type { CSSProperties } from "react";
import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import type { Review } from "@/lib/types";

const ROW_PAD_Y = 18;

export type ReviewRowProps = {
  review: Review;
  /** True when the keyboard cursor is sitting on this row. */
  focused: boolean;
  onOpen: () => void;
  onApprove: () => void;
};

export function ReviewRow({
  review,
  focused,
  onOpen,
  onApprove,
}: ReviewRowProps) {
  const wrapStyle: CSSProperties = {
    minWidth: 0,
    overflow: "hidden",
    transition:
      "opacity var(--dur-base) var(--ease-out), max-height var(--dur-base) var(--ease-out), transform var(--dur-base) var(--ease-out)",
    ...(review.leaving
      ? { opacity: 0, maxHeight: 0, transform: "translateX(18px)" }
      : { opacity: 1, maxHeight: 420 }),
  };

  return (
    <div style={wrapStyle}>
      {review.lane === "escalated" ? (
        <EscalatedSlab review={review} focused={focused} onOpen={onOpen} />
      ) : (
        <StandardRow
          review={review}
          focused={focused}
          onOpen={onOpen}
          onApprove={onApprove}
        />
      )}
    </div>
  );
}

function EscalatedSlab({
  review,
  focused,
  onOpen,
}: {
  review: Review;
  focused: boolean;
  onOpen: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      style={{
        background: "var(--surface-inverse)",
        borderRadius: "var(--radius-card)",
        padding: "var(--space-6) var(--space-8)",
        cursor: "pointer",
        boxShadow: focused
          ? "0 0 0 2px var(--ink-1000), 0 0 0 4px var(--ink-300)"
          : undefined,
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
        <Badge variant="light" size="sm">
          Escalated
        </Badge>
        <span style={{ font: "var(--type-meta)", color: "var(--text-on-dark)" }}>
          {review.category}
        </span>
        <span
          style={{
            marginLeft: "auto",
            font: "var(--type-meta)",
            color: "var(--text-on-dark-muted)",
          }}
        >
          {`${review.stars} of 5 · ${review.date}`}
        </span>
      </div>

      <div
        style={{
          marginTop: "var(--space-5)",
          font: "var(--type-post-title)",
          letterSpacing: "var(--tracking-snug)",
          color: "var(--text-on-dark)",
          maxWidth: "60ch",
        }}
      >
        {review.text}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
          flexWrap: "wrap",
          marginTop: "var(--space-6)",
        }}
      >
        <span
          style={{
            font: "var(--type-body-sm)",
            color: "var(--text-on-dark-muted)",
          }}
        >
          {review.name} · no draft, a person has to answer this
        </span>
        <span style={{ marginLeft: "auto" }}>
          <Button
            variant="inverse"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onOpen();
            }}
          >
            Open
          </Button>
        </span>
      </div>
    </div>
  );
}

function StandardRow({
  review,
  focused,
  onOpen,
  onApprove,
}: {
  review: Review;
  focused: boolean;
  onOpen: () => void;
  onApprove: () => void;
}) {
  const done = review.status !== "needs";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      style={{
        display: "block",
        padding: `${ROW_PAD_Y}px var(--space-6)`,
        border: `1px solid ${focused ? "var(--border-focus)" : "var(--border-subtle)"}`,
        borderRadius: "var(--radius-card)",
        background: focused ? "var(--surface-subtle)" : "var(--surface-page)",
        cursor: "pointer",
        minWidth: 0,
        transition: "var(--transition-control)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-5)",
          flexWrap: "wrap",
          minWidth: 0,
        }}
      >
        <span
          style={{
            flex: "none",
            font: "var(--type-label)",
            letterSpacing: "var(--tracking-snug)",
          }}
        >
          {review.stars}
          <span style={{ color: "var(--text-faint)" }}>/5</span>
        </span>
        <span
          style={{
            flex: "none",
            font: "var(--type-label)",
            letterSpacing: "var(--tracking-snug)",
            whiteSpace: "nowrap",
          }}
        >
          {review.name}
        </span>
        <span
          style={{
            flex: "none",
            font: "var(--type-meta)",
            whiteSpace: "nowrap",
            color:
              review.lane === "generated"
                ? "var(--text-primary)"
                : "var(--text-muted)",
          }}
        >
          {review.lane === "generated" ? "AI draft ready" : "Template ready"}
        </span>
        <span
          style={{
            flex: "none",
            font: "var(--type-meta)",
            color: "var(--text-muted)",
            whiteSpace: "nowrap",
          }}
        >
          {review.date}
        </span>
        <span
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
            flex: "none",
          }}
        >
          {done ? (
            <span
              style={{
                font: "var(--type-meta)",
                color: "var(--text-muted)",
                whiteSpace: "nowrap",
              }}
            >
              {review.status === "published" ? "Published" : "Approved"}
            </span>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onApprove();
              }}
            >
              Approve
            </Button>
          )}
        </span>
      </div>

      <div
        style={{
          marginTop: "var(--space-3)",
          minWidth: 0,
          font: "var(--type-post-title)",
          fontSize: "var(--size-body)",
          letterSpacing: "var(--tracking-snug)",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          color: review.text ? "var(--text-primary)" : "var(--text-faint)",
        }}
      >
        {review.text || "No text — rating only"}
      </div>
    </div>
  );
}
