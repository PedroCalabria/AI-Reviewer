import { logActivity } from "@/lib/activity";
import { categoryLabel } from "@/lib/config/escalation";
import { prisma } from "@/lib/db";
import type { PipelineOutcome } from "@/lib/pipeline";

/**
 * Writing a pipeline result to the database.
 *
 * Kept apart from the pipeline itself, which is pure: it decides, this records.
 * That separation is what lets the guardrail suite run the decisions thousands
 * of times a second with no database in sight.
 */

export type ApplyTarget = {
  id: string;
  organizationId: string;
  locationId: string;
  authorName: string;
};

function shortName(fullName: string): string {
  return fullName.trim() || "an anonymous reviewer";
}

/** Cache the classifier verdict so a re-sync never pays for it twice. */
async function cacheClassification(
  reviewId: string,
  outcome: PipelineOutcome,
): Promise<void> {
  const classification =
    "classification" in outcome ? outcome.classification : undefined;
  if (!classification) return;

  await prisma.review.update({
    where: { id: reviewId },
    data: {
      classifiedAt: new Date(),
      classifierCategory: classification.category,
      classifierConfidence: classification.confidence,
    },
  });
}

export async function applyOutcome(
  target: ApplyTarget,
  outcome: PipelineOutcome,
): Promise<void> {
  await cacheClassification(target.id, outcome);

  const base = {
    organizationId: target.organizationId,
    locationId: target.locationId,
    reviewId: target.id,
  };

  if (outcome.route === "ESCALATE") {
    await prisma.review.update({
      where: { id: target.id },
      data: {
        route: "ESCALATE",
        status: "NEEDS_REVIEW",
        escalationCategory: outcome.category,
        escalationTrigger: outcome.trigger,
        escalationEvidence: outcome.evidence,
        themesJson: "[]",
      },
    });

    const why = outcome.failureReason
      ? "we could not check it automatically, so it was not drafted"
      : `${categoryLabel(outcome.category).toLowerCase()} detected`;

    await logActivity({
      ...base,
      type: "Escalation",
      actor: "System",
      message: `Escalated review from ${shortName(target.authorName)} — ${why}. No reply was drafted.`,
    });
    return;
  }

  if (outcome.route === "TEMPLATE") {
    await prisma.$transaction(async (tx) => {
      await tx.review.update({
        where: { id: target.id },
        data: {
          route: "TEMPLATE",
          status: "NEEDS_REVIEW",
          templateVariant: outcome.variant,
          themesJson: "[]",
        },
      });

      await tx.draft.updateMany({
        where: { reviewId: target.id },
        data: { isCurrent: false },
      });

      await tx.draft.create({
        data: {
          reviewId: target.id,
          attempt: 1,
          source: "TEMPLATE",
          rawOutput: outcome.text,
          validatedOutput: outcome.text,
          passedValidation: true,
          isCurrent: true,
          toneUsed: outcome.templateId.split(":")[0],
        },
      });
    });

    await logActivity({
      ...base,
      type: "Template",
      actor: "System",
      message: `Template reply for ${shortName(target.authorName)} · no AI used`,
    });
    return;
  }

  // --- The generation route ------------------------------------------------

  if (outcome.outcome === "paused" || outcome.outcome === "failed") {
    // Deliberately leaves `route` null. An untriaged review is what the next
    // sync looks for, so a review skipped while the budget was spent gets
    // picked up tomorrow instead of being stranded in a lane it never reached.
    await prisma.review.update({
      where: { id: target.id },
      data: { status: "NEEDS_REVIEW" },
    });

    await logActivity({
      ...base,
      type: "AI",
      actor: "AI",
      message:
        outcome.outcome === "paused"
          ? `No draft for ${shortName(target.authorName)} — ${outcome.reason} It stays in the queue for the next sync.`
          : `Could not draft a reply for ${shortName(target.authorName)} — ${outcome.reason}`,
    });
    return;
  }

  if (outcome.outcome === "needs_manual_reply") {
    await prisma.$transaction(async (tx) => {
      await tx.review.update({
        where: { id: target.id },
        data: {
          route: "GENERATE",
          status: "NEEDS_MANUAL_REPLY",
          themesJson: "[]",
        },
      });

      // Both attempts are kept and neither is current: the screen shows what we
      // tried, and nothing we tried is offered as a draft.
      for (const attempt of outcome.attempts) {
        const draft = await tx.draft.create({
          data: {
            reviewId: target.id,
            attempt: attempt.attempt,
            source: "AI",
            rawOutput: attempt.result.reply,
            toneUsed: attempt.result.toneUsed,
            reasoning: attempt.result.reasoning,
            themesJson: JSON.stringify(attempt.result.themes ?? []),
            passedValidation: false,
            isCurrent: false,
          },
        });

        for (const violation of attempt.violations) {
          await tx.guardrailEvent.create({
            data: {
              reviewId: target.id,
              draftId: draft.id,
              code: violation.code,
              pattern: violation.pattern,
              excerpt: violation.excerpt,
              attempt: attempt.attempt,
              outcome: "FAILED",
              note: "We couldn't draft this one within the safety rules.",
            },
          });
        }
      }
    });

    await logActivity({
      ...base,
      type: "Guardrail",
      actor: "Guardrail",
      message: `Blocked both drafts for ${shortName(target.authorName)} — handed to a person to write`,
    });
    return;
  }

  // outcome === "drafted"
  await prisma.$transaction(async (tx) => {
    await tx.review.update({
      where: { id: target.id },
      data: {
        route: "GENERATE",
        status: "NEEDS_REVIEW",
        themesJson: JSON.stringify(outcome.themes ?? []),
      },
    });

    await tx.draft.updateMany({
      where: { reviewId: target.id },
      data: { isCurrent: false },
    });

    for (const attempt of outcome.attempts) {
      const isWinner = attempt.attempt === outcome.attempts.length;

      const draft = await tx.draft.create({
        data: {
          reviewId: target.id,
          attempt: attempt.attempt,
          source: "AI",
          rawOutput: attempt.result.reply,
          validatedOutput: isWinner ? outcome.reply : null,
          toneUsed: attempt.result.toneUsed,
          reasoning: attempt.result.reasoning,
          themesJson: JSON.stringify(attempt.result.themes ?? []),
          passedValidation: isWinner,
          isCurrent: isWinner,
        },
      });

      // Repairs hang off the attempt that broke the rule, not the one that
      // fixed it, so "what changed" reads in the right order.
      if (!isWinner) {
        for (const repair of outcome.repairs) {
          await tx.guardrailEvent.create({
            data: {
              reviewId: target.id,
              draftId: draft.id,
              code: repair.code,
              pattern: repair.pattern,
              excerpt: repair.removed,
              attempt: attempt.attempt,
              outcome: "REPAIRED",
              note: repair.note,
              removedText: repair.removed,
              replacedText: repair.replaced,
            },
          });
        }
      }
    }
  });

  await logActivity({
    ...base,
    type: "AI",
    actor: "AI",
    message: `Drafted reply for ${shortName(target.authorName)}${
      outcome.reasoning ? ` — ${outcome.reasoning}` : ""
    }`,
  });

  for (const repair of outcome.repairs) {
    await logActivity({
      ...base,
      type: "Guardrail",
      actor: "Guardrail",
      message: `Rewrote draft for ${shortName(target.authorName)} — ${repair.note
        .replace(/^Adjusted: /, "")
        .replace(/\.$/, "")}`,
    });
  }
}
