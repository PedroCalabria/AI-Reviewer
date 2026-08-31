import { TONES } from "./data";
import type { Review, ToneName } from "./types";

/**
 * The tone examples in TONES were all written for Dana K.'s review, so
 * regenerating that one can show the real voice difference. Every other review
 * gets a marker prefix instead.
 *
 * This is the seam where a model call belongs: replace the body of
 * `regenerateDraft` with a request that sends the review text, the selected
 * tone, and the guardrails, and returns the guardrail-checked draft.
 */
const TONE_SHOWCASE_REVIEW_ID = "r7";

const REGENERATED_PREFIX = "Rewritten";

export function regenerateDraft(review: Review, tone: ToneName): string {
  if (review.id === TONE_SHOWCASE_REVIEW_ID) {
    const match = TONES.find((t) => t.name === tone) ?? TONES[0];
    return match.example;
  }

  // Regenerating an already-regenerated draft returns to the original.
  if (review.draftText.startsWith(REGENERATED_PREFIX)) {
    return review.draft ?? review.draftText;
  }

  return `${REGENERATED_PREFIX} in a ${tone.toLowerCase()} voice. ${review.draft ?? ""}`;
}

/** How long the regeneration spinner runs while the stub "thinks". */
export const REGENERATE_MS = 620;
