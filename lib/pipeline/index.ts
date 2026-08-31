import type { ClassifierResult } from "@/lib/ai/schemas";
import { AiBudgetExhaustedError, AiUnavailableError } from "@/lib/ai/types";
import { escalationGate } from "./escalation";
import { generateReply, repairReply, sentencesAddedIn } from "./generate";
import { templateGate } from "./template";
import type {
  GenerationAttempt,
  PipelineContext,
  PipelineOutcome,
  PipelineReview,
  Repair,
  Violation,
} from "./types";
import { repairNoteFor, validateReply, type ValidatorContext } from "./validate";

export * from "./types";
export { escalationGate, matchKeywords, classifyReview } from "./escalation";
export {
  templateGate,
  TEMPLATE_MAX_LENGTH,
  TEMPLATE_MIN_RATING,
} from "./template";
export {
  buildSystemInstruction,
  generateReply,
  repairReply,
  sentencesAddedIn,
} from "./generate";
export {
  findNamedIndividuals,
  splitSentences,
  validateReply,
  type ValidatorContext,
} from "./validate";

/**
 * The four-stage pipeline.
 *
 *   1. Escalation gate  — keywords, in union with a classifier. Runs first,
 *                         always. If it fires, nothing is drafted and no
 *                         generative call is made.
 *   2. Template gate    — a good rating with next to nothing written gets
 *                         canned text. Costs nothing.
 *   3. Generation       — the only generative call, for whatever is left.
 *   4. Output validator — deterministic, on every generated reply, with one
 *                         repair attempt and then a stop.
 *
 * Each stage is its own module so it can be tested alone. This function is only
 * the sequencing, which is why it is short and has no branches of its own.
 */
export async function runPipeline(
  review: PipelineReview,
  ctx: PipelineContext,
): Promise<PipelineOutcome> {
  // --- Stage 1 -------------------------------------------------------------
  const escalation = await escalationGate(review, ctx);
  if (escalation.route) {
    return {
      route: "ESCALATE",
      category: escalation.route.category,
      trigger: escalation.route.trigger,
      evidence: escalation.route.evidence,
      classification: escalation.route.classification,
      failureReason: escalation.route.failureReason,
    };
  }

  const classification = escalation.classification;

  // --- Stage 2 -------------------------------------------------------------
  // Template routing runs even when the model is unreachable. It costs nothing,
  // it needs nothing checked — a five-star rating with no text has no content
  // to screen — and it is most of a busy queue.
  const template = templateGate(review, ctx.brandVoice.tone);
  if (template) {
    return {
      route: "TEMPLATE",
      templateId: template.templateId,
      variant: template.variant,
      text: template.text,
    };
  }

  // The escalation gate never ran, so this review has not been screened. It
  // must not be drafted for, and it must not be presented as safe.
  if (escalation.unavailable) {
    return {
      route: "GENERATE",
      outcome: "paused",
      reason: escalation.unavailable.reason,
    };
  }

  // --- Stages 3 and 4 ------------------------------------------------------
  return generateWithGuardrails(review, ctx, classification);
}

/** The generate → validate → repair → stop loop. */
async function generateWithGuardrails(
  review: PipelineReview,
  ctx: PipelineContext,
  classification: ClassifierResult | undefined,
): Promise<PipelineOutcome> {
  // The language is filled in per attempt from what the model says it wrote,
  // because the named-individual check is only meaningful for English.
  const validatorContext = (language: string): ValidatorContext => ({
    businessName: ctx.businessName,
    reviewerName: review.authorName,
    language,
  });

  const attempts: GenerationAttempt[] = [];

  try {
    const first = await generateReply(review, ctx);
    const firstViolations = validateReply(
      first.reply,
      validatorContext(first.language),
    );
    attempts.push({ attempt: 1, result: first, violations: firstViolations });

    if (firstViolations.length === 0) {
      return {
        route: "GENERATE",
        outcome: "drafted",
        reply: first.reply,
        themes: first.themes,
        toneUsed: first.toneUsed || ctx.brandVoice.tone,
        reasoning: first.reasoning,
        attempts,
        repairs: [],
        classification,
      };
    }

    // Exactly one repair attempt. Never a third.
    const second = await repairReply(review, ctx, first.reply, firstViolations);
    const secondViolations = validateReply(
      second.reply,
      validatorContext(second.language),
    );
    attempts.push({ attempt: 2, result: second, violations: secondViolations });

    if (secondViolations.length > 0) {
      return {
        route: "GENERATE",
        outcome: "needs_manual_reply",
        attempts,
        violations: secondViolations,
        classification,
      };
    }

    return {
      route: "GENERATE",
      outcome: "drafted",
      reply: second.reply,
      themes: second.themes,
      toneUsed: second.toneUsed || ctx.brandVoice.tone,
      reasoning: second.reasoning,
      attempts,
      repairs: summarizeRepairs(first.reply, second.reply, firstViolations),
      classification,
    };
  } catch (error) {
    // No key, or the day's budget is spent. Not a failure — the review simply
    // waits, and template routing carries on costing nothing.
    if (
      error instanceof AiUnavailableError ||
      error instanceof AiBudgetExhaustedError
    ) {
      return {
        route: "GENERATE",
        outcome: "paused",
        reason: error.message,
        classification,
      };
    }

    return {
      route: "GENERATE",
      outcome: "failed",
      reason:
        error instanceof Error ? error.message : "Unknown generation error.",
      classification,
    };
  }
}

/**
 * Turn the first attempt's violations into the "Adjusted: …" notes shown under
 * a draft. One note per rule broken, not one per match — the owner cares which
 * promise was removed, not how many times the model made it.
 */
export function summarizeRepairs(
  before: string,
  after: string,
  violations: Violation[],
): Repair[] {
  const written = sentencesAddedIn(after, before);
  const firstPerCode = new Map<string, Violation>();

  for (const violation of violations) {
    if (!firstPerCode.has(violation.code)) {
      firstPerCode.set(violation.code, violation);
    }
  }

  return [...firstPerCode.values()].map((violation) => ({
    code: violation.code,
    pattern: violation.pattern,
    note: repairNoteFor(violation.code),
    removed: violation.excerpt,
    replaced: written,
  }));
}
