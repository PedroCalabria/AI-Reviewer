import { templateText, templateVariantFor } from "@/lib/config/templates";
import type { ToneName } from "@/lib/constants";
import type { PipelineReview, TriageRoute } from "./types";

/**
 * Stage 2 — the template gate.
 *
 * A good rating with little or nothing written gets a rotating canned reply.
 * Zero cost, instant, no model call. This is where most of a busy profile's
 * queue goes, which is exactly why it must not touch the LLM budget.
 */

/** Four stars or better. */
export const TEMPLATE_MIN_RATING = 4;

/**
 * Strictly fewer than 40 characters of written text. A review at exactly 40
 * has enough in it to be worth answering specifically.
 */
export const TEMPLATE_MAX_LENGTH = 40;

export function templateGate(
  review: PipelineReview,
  tone: ToneName,
): Extract<TriageRoute, { route: "TEMPLATE" }> | null {
  if (review.rating < TEMPLATE_MIN_RATING) return null;
  if (review.text.trim().length >= TEMPLATE_MAX_LENGTH) return null;

  // Rotate by review ID rather than at random, so the same review always shows
  // the same reply and a profile does not end up with four identical ones in a
  // row.
  const variant = templateVariantFor(review.id);

  return {
    route: "TEMPLATE",
    templateId: `${tone}:${variant}`,
    variant,
    text: templateText(tone, variant),
  };
}
