import {
  CLASSIFIER_RESPONSE_SCHEMA,
  classifierResult,
  type ClassifierResult,
} from "@/lib/ai/schemas";
import { AiBudgetExhaustedError, AiUnavailableError } from "@/lib/ai/types";
import { ESCALATION_CONFIDENCE_THRESHOLD, MODELS } from "@/lib/config/ai";
import {
  ESCALATION_KEYWORDS,
  isEscalatable,
} from "@/lib/config/escalation";
import type { EscalatableCategory } from "@/lib/constants";
import type { PipelineContext, PipelineReview, TriageRoute } from "./types";

/**
 * Stage 1 — the escalation gate. Runs first, always.
 *
 * When this fires the system refuses to draft anything. No generative call is
 * made; the review goes to a human with the triggering evidence attached.
 *
 * Two sources, combined as a union so recall stays high. A keyword hit short-
 * circuits the classifier entirely, which is both faster and free.
 */

/** Word-boundary matching against normalized text. */
function normalize(text: string): string {
  return text
    .toLowerCase()
    // Curly quotes and dashes would otherwise break a boundary mid-phrase.
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type KeywordHit = {
  category: EscalatableCategory;
  /** The phrase from the list that matched. */
  phrase: string;
  /** The matching span as it appears in the original review text, verbatim. */
  evidence: string;
};

/**
 * The first trigger phrase present in the review, or null.
 *
 * Ordering follows ESCALATION_KEYWORDS, so a review that trips both a legal and
 * a health phrase is labelled with whichever category is declared first. Both
 * end in the same place — a human reading the quote — so the ordering is a
 * display detail, not a safety one.
 */
export function matchKeywords(text: string): KeywordHit | null {
  if (!text.trim()) return null;
  const haystack = normalize(text);

  for (const [category, phrases] of Object.entries(ESCALATION_KEYWORDS)) {
    for (const phrase of phrases) {
      const pattern = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "i");
      const match = pattern.exec(haystack);
      if (!match) continue;

      // Quote the original text rather than the normalized copy, so the detail
      // screen can find and underline the span.
      const original = new RegExp(`\\b${escapeRegExp(phrase)}\\b`, "i").exec(text);
      return {
        category: category as EscalatableCategory,
        phrase,
        evidence: original?.[0] ?? phrase,
      };
    }
  }

  return null;
}

const CLASSIFIER_SYSTEM_INSTRUCTION = `You screen customer reviews of a business for content that a human must handle personally, instead of an automated reply.

Return the single most serious category that applies:

LEGAL_THREAT — the customer threatens or mentions legal action, a lawyer, a lawsuit, a claim, or a regulator.
HEALTH_SAFETY — illness, injury from food, contamination, pests, allergens, or unsafe premises.
DISCRIMINATION — the customer alleges they were treated differently because of race, religion, disability, gender, sexuality, age, or similar.
PHYSICAL_HARM — someone was hit, restrained, threatened, or physically hurt.
STAFF_MISCONDUCT — a serious accusation against a person: theft, fraud, intoxication on duty, harassment.
MINOR_SAFETY — a child was put at risk, harmed, or left unsupervised.
NONE — everything else, including ordinary complaints about food, price, waiting, noise, or rudeness.

Rules:
- Ordinary bad service is NONE, however angry the review is. Rudeness alone is NONE, not STAFF_MISCONDUCT.
- Judge what the customer is claiming happened, not how they say it.
- "evidence" must be copied character-for-character from the review. Never paraphrase it, never translate it, never add quotation marks. If the category is NONE, return an empty string.
- Reviews may be in any language. Classify them in that language and quote the evidence in that language.`;

/** Stage 1's LLM half. Cheap model, one narrow question, cached forever. */
export async function classifyReview(
  review: PipelineReview,
  ctx: PipelineContext,
): Promise<ClassifierResult> {
  if (ctx.cachedClassification) return ctx.cachedClassification;

  return ctx.ai.generateStructured<ClassifierResult>({
    model: MODELS.classifier,
    label: "classifier",
    systemInstruction: CLASSIFIER_SYSTEM_INSTRUCTION,
    prompt: `Rating: ${review.rating} out of 5\nReview: ${review.text}`,
    responseSchema: CLASSIFIER_RESPONSE_SCHEMA,
    parse: (raw) => classifierResult.parse(raw),
  });
}

/**
 * Was the model's evidence actually copied from the review?
 *
 * The detail screen underlines the span inside the review text, so a
 * paraphrase would silently fail to highlight. Falling back to an empty string
 * is better than quoting something the customer never wrote.
 */
function verbatimEvidence(evidence: string, reviewText: string): string {
  const trimmed = evidence.trim().replace(/^["'“‘]|["'”’]$/g, "");
  if (!trimmed) return "";
  if (reviewText.includes(trimmed)) return trimmed;

  // Case-insensitive fallback: recover the span as the customer wrote it.
  const at = reviewText.toLowerCase().indexOf(trimmed.toLowerCase());
  return at >= 0 ? reviewText.slice(at, at + trimmed.length) : "";
}

export type EscalationDecision = {
  route: Extract<TriageRoute, { route: "ESCALATE" }> | null;
  /** Present when a classifier call happened and succeeded, so it can be cached. */
  classification?: ClassifierResult;
  /**
   * Set when the classifier could not run at all — no key configured, or the
   * day's budget is spent. Distinct from a call that ran and failed, and
   * handled differently: see the note in escalationGate.
   */
  unavailable?: { reason: string };
};

/**
 * The whole of stage 1.
 *
 * On a classifier call that fails or times out, this fails closed and
 * escalates. A false escalation costs a minute of the owner's time; a missed
 * one can cost a lawsuit, so the asymmetry decides the default.
 *
 * "The classifier could not run at all" is a different thing and is not treated
 * as a failure to check. Failing closed on a missing API key would label every
 * review in the queue an escalation, including the five-star ones — which is
 * not a safe default, it is a wrong one, and it would teach the owner to ignore
 * the escalation badge. Those reviews are reported as unscreened instead, and
 * the next sync picks them up.
 */
export async function escalationGate(
  review: PipelineReview,
  ctx: PipelineContext,
): Promise<EscalationDecision> {
  const keyword = matchKeywords(review.text);
  if (keyword) {
    return {
      route: {
        route: "ESCALATE",
        category: keyword.category,
        trigger: "keyword",
        evidence: keyword.evidence,
      },
    };
  }

  // Nothing written means nothing to classify, and nothing to escalate on.
  if (!review.text.trim()) return { route: null };

  let classification: ClassifierResult;
  try {
    classification = await classifyReview(review, ctx);
  } catch (error) {
    if (
      error instanceof AiUnavailableError ||
      error instanceof AiBudgetExhaustedError
    ) {
      return { route: null, unavailable: { reason: error.message } };
    }

    const reason =
      error instanceof Error ? error.message : "the classifier was unavailable";
    return {
      route: {
        route: "ESCALATE",
        category: null,
        trigger: "classifier",
        evidence: "",
        failureReason: reason,
      },
    };
  }

  const escalates =
    isEscalatable(classification.category) &&
    classification.confidence >= ESCALATION_CONFIDENCE_THRESHOLD;

  if (!escalates) return { route: null, classification };

  return {
    classification,
    route: {
      route: "ESCALATE",
      category: classification.category as EscalatableCategory,
      trigger: "classifier",
      evidence: verbatimEvidence(classification.evidence, review.text),
      classification,
    },
  };
}
