"use server";

import { revalidatePath } from "next/cache";
import { aiClient } from "@/lib/ai/gemini";
import { logActivity } from "@/lib/activity";
import { MODELS } from "@/lib/config/ai";
import { templateText, TEMPLATE_VARIANT_COUNT } from "@/lib/config/templates";
import { isToneName, type ToneName } from "@/lib/constants";
import { prisma } from "@/lib/db";
import {
  generateReply,
  repairReply,
  sentencesAddedIn,
  summarizeRepairs,
  validateReply,
  type PipelineContext,
} from "@/lib/pipeline";
import { getReviewProvider } from "@/lib/providers";
import { syncNow as runSyncNow } from "@/lib/sync/runSync";
import {
  activeLocationIdForAction,
  assertOwnsReview,
  requireTenantForAction,
} from "@/lib/tenancy";

/**
 * Every mutation the desk can perform.
 *
 * All of them start by resolving the tenant from the session and, where a
 * review ID is involved, confirming the review belongs to that organization.
 * The ID the client sends is untrusted input until assertOwnsReview has run.
 */

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

function refresh() {
  revalidatePath("/inbox");
  revalidatePath("/activity");
  revalidatePath("/settings");
}

async function brandVoiceFor(organizationId: string) {
  const record = await prisma.brandVoice.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  });

  return {
    tone: (isToneName(record.tone) ? record.tone : "Warm") as ToneName,
    alwaysMention: record.alwaysMention,
    contactEmail: record.contactEmail,
  };
}

/** The text that would actually be posted for a review right now. */
async function currentReplyText(reviewId: string): Promise<string> {
  const draft = await prisma.draft.findFirst({
    where: { reviewId, isCurrent: true },
  });
  return draft?.humanEdited ?? draft?.validatedOutput ?? draft?.rawOutput ?? "";
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

export async function approveAndPublish(reviewId: string): Promise<ActionResult> {
  const tenant = await requireTenantForAction();
  const owned = await assertOwnsReview(tenant.organizationId, reviewId);

  const review = await prisma.review.findUniqueOrThrow({
    where: { id: owned.id },
    include: { location: true },
  });

  const reply = await currentReplyText(review.id);
  if (!reply.trim()) {
    return { ok: false, error: "There is nothing to publish yet." };
  }

  const provider = getReviewProvider();
  const result = await provider.publishReply(
    review.location.externalId,
    review.externalId,
    reply,
  );

  if (!result.published) {
    await logActivity({
      organizationId: tenant.organizationId,
      locationId: review.locationId,
      reviewId: review.id,
      type: "You",
      actor: tenant.userName || tenant.userEmail,
      message: `Could not publish the reply to ${review.authorName} — ${result.detail}`,
    });
    return { ok: false, error: result.detail };
  }

  await prisma.review.update({
    where: { id: review.id },
    data: { status: "PUBLISHED", publishedAt: new Date() },
  });

  // The activity log says where the reply actually went. With the synthetic
  // provider that means saying, in as many words, that it went nowhere.
  await logActivity({
    organizationId: tenant.organizationId,
    locationId: review.locationId,
    reviewId: review.id,
    type: "You",
    actor: tenant.userName || tenant.userEmail,
    message: `Approved and published reply to ${review.authorName}. ${result.detail}`,
  });

  refresh();
  return { ok: true, message: `Published reply to ${review.authorName}` };
}

export async function approveAllTemplates(): Promise<ActionResult> {
  const tenant = await requireTenantForAction();
  const locationId = await activeLocationIdForAction(tenant);
  if (!locationId) return { ok: false, error: "No location selected." };

  const pending = await prisma.review.findMany({
    where: {
      locationId,
      location: { organizationId: tenant.organizationId },
      route: "TEMPLATE",
      status: "NEEDS_REVIEW",
    },
    select: { id: true },
  });

  let published = 0;
  for (const review of pending) {
    const result = await approveAndPublish(review.id);
    if (result.ok) published++;
  }

  refresh();
  return {
    ok: true,
    message: `${published} template ${published === 1 ? "reply" : "replies"} published`,
  };
}

export async function markHandled(reviewId: string): Promise<ActionResult> {
  const tenant = await requireTenantForAction();
  const owned = await assertOwnsReview(tenant.organizationId, reviewId);

  const review = await prisma.review.update({
    where: { id: owned.id },
    data: { status: "HANDLED_EXTERNALLY" },
  });

  await logActivity({
    organizationId: tenant.organizationId,
    locationId: owned.locationId,
    reviewId: owned.id,
    type: "You",
    actor: tenant.userName || tenant.userEmail,
    message: `Marked the review from ${review.authorName} as handled outside the tool. Nothing was published.`,
  });

  refresh();
  return { ok: true, message: "Marked as handled — no reply published" };
}

// ---------------------------------------------------------------------------
// Editing the draft
// ---------------------------------------------------------------------------

export async function saveDraftEdit(
  reviewId: string,
  text: string,
): Promise<ActionResult> {
  const tenant = await requireTenantForAction();
  const owned = await assertOwnsReview(tenant.organizationId, reviewId);

  const current = await prisma.draft.findFirst({
    where: { reviewId: owned.id, isCurrent: true },
  });

  if (current) {
    await prisma.draft.update({
      where: { id: current.id },
      data: { humanEdited: text },
    });
  } else {
    // The escalated and manual lanes have no draft to edit, so the operator's
    // own words become one — marked HUMAN, so the log and the detail screen can
    // keep saying which words are whose.
    await prisma.draft.create({
      data: {
        reviewId: owned.id,
        attempt: 1,
        source: "HUMAN",
        rawOutput: text,
        humanEdited: text,
        passedValidation: true,
        isCurrent: true,
      },
    });
  }

  return { ok: true };
}

export async function cycleTemplate(reviewId: string): Promise<ActionResult> {
  const tenant = await requireTenantForAction();
  const owned = await assertOwnsReview(tenant.organizationId, reviewId);

  const review = await prisma.review.findUniqueOrThrow({
    where: { id: owned.id },
  });
  const voice = await brandVoiceFor(tenant.organizationId);

  const next = ((review.templateVariant ?? 0) + 1) % TEMPLATE_VARIANT_COUNT;
  const text = templateText(voice.tone, next);

  await prisma.$transaction(async (tx) => {
    await tx.review.update({
      where: { id: owned.id },
      data: { templateVariant: next },
    });
    await tx.draft.updateMany({
      where: { reviewId: owned.id },
      data: { isCurrent: false },
    });
    await tx.draft.create({
      data: {
        reviewId: owned.id,
        attempt: 1,
        source: "TEMPLATE",
        rawOutput: text,
        validatedOutput: text,
        toneUsed: voice.tone,
        passedValidation: true,
        isCurrent: true,
      },
    });
  });

  refresh();
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Regeneration
// ---------------------------------------------------------------------------

/**
 * The regenerate button.
 *
 * This is a user-triggered generation, so it goes through exactly the same
 * validator and the same single repair attempt as the sync does. There is no
 * path in this application that puts model output in front of a person without
 * the validator having seen it.
 */
export async function regenerateDraft(
  reviewId: string,
  toneChoice: string,
): Promise<ActionResult> {
  const tenant = await requireTenantForAction();
  const owned = await assertOwnsReview(tenant.organizationId, reviewId);

  const review = await prisma.review.findUniqueOrThrow({
    where: { id: owned.id },
  });

  if (review.route === "ESCALATE") {
    return {
      ok: false,
      error: "This review was escalated. We don't draft replies for those.",
    };
  }

  const ai = aiClient();
  if (!(await ai.hasBudget(MODELS.generation))) {
    return {
      ok: false,
      error: "AI drafts are paused — the daily limit is reached.",
    };
  }

  const voice = await brandVoiceFor(tenant.organizationId);
  const tone = isToneName(toneChoice) ? toneChoice : voice.tone;

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: tenant.organizationId },
    select: { name: true },
  });

  const ctx: PipelineContext = {
    ai,
    businessName: organization.name,
    brandVoice: { ...voice, tone },
  };

  const pipelineReview = {
    id: review.externalId,
    rating: review.rating,
    text: review.text,
    authorName: review.authorName,
  };

  const validatorContext = (language: string) => ({
    businessName: organization.name,
    reviewerName: review.authorName,
    language,
  });

  try {
    const first = await generateReply(pipelineReview, ctx);
    let winner = first;
    let repairs: ReturnType<typeof summarizeRepairs> = [];

    const firstViolations = validateReply(
      first.reply,
      validatorContext(first.language),
    );

    if (firstViolations.length > 0) {
      const second = await repairReply(
        pipelineReview,
        ctx,
        first.reply,
        firstViolations,
      );
      const secondViolations = validateReply(
        second.reply,
        validatorContext(second.language),
      );

      if (secondViolations.length > 0) {
        await logActivity({
          organizationId: tenant.organizationId,
          locationId: owned.locationId,
          reviewId: owned.id,
          type: "Guardrail",
          actor: "Guardrail",
          message: `Blocked a regenerated draft for ${review.authorName} — it broke the same rules twice`,
        });
        return {
          ok: false,
          error:
            "We couldn't draft that one within the safety rules. The previous draft is unchanged.",
        };
      }

      winner = second;
      repairs = summarizeRepairs(first.reply, second.reply, firstViolations);
      void sentencesAddedIn;
    }

    const attemptNumber =
      (await prisma.draft.count({ where: { reviewId: owned.id } })) + 1;

    await prisma.$transaction(async (tx) => {
      await tx.draft.updateMany({
        where: { reviewId: owned.id },
        data: { isCurrent: false },
      });
      // Replacing the draft replaces the notes under it, so the "Adjusted"
      // line always describes the text on screen rather than a previous one.
      await tx.guardrailEvent.deleteMany({
        where: { reviewId: owned.id, outcome: "REPAIRED" },
      });

      const draft = await tx.draft.create({
        data: {
          reviewId: owned.id,
          attempt: attemptNumber,
          source: "AI",
          rawOutput: first.reply,
          validatedOutput: winner.reply,
          toneUsed: winner.toneUsed || tone,
          reasoning: winner.reasoning,
          themesJson: JSON.stringify(winner.themes ?? []),
          passedValidation: true,
          isCurrent: true,
        },
      });

      await tx.review.update({
        where: { id: owned.id },
        data: {
          route: "GENERATE",
          status: "NEEDS_REVIEW",
          themesJson: JSON.stringify(winner.themes ?? []),
        },
      });

      for (const repair of repairs) {
        await tx.guardrailEvent.create({
          data: {
            reviewId: owned.id,
            draftId: draft.id,
            code: repair.code,
            pattern: repair.pattern,
            excerpt: repair.removed,
            attempt: attemptNumber,
            outcome: "REPAIRED",
            note: repair.note,
            removedText: repair.removed,
            replacedText: repair.replaced,
          },
        });
      }
    });

    await logActivity({
      organizationId: tenant.organizationId,
      locationId: owned.locationId,
      reviewId: owned.id,
      type: "AI",
      actor: "AI",
      message: `Regenerated reply for ${review.authorName} (${tone.toLowerCase()} voice)`,
    });

    refresh();
    return { ok: true, message: `Regenerated in a ${tone.toLowerCase()} voice` };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "The model call failed. Try again in a moment.",
    };
  }
}

// ---------------------------------------------------------------------------
// Sync, settings, location
// ---------------------------------------------------------------------------

export async function syncNow(): Promise<ActionResult> {
  const tenant = await requireTenantForAction();
  const locationId = await activeLocationIdForAction(tenant);
  if (!locationId) return { ok: false, error: "No location selected." };

  const result = await runSyncNow(locationId, "manual");
  refresh();

  if (result.status === "failed") {
    return { ok: false, error: result.error ?? "The sync failed." };
  }

  if (result.reviewsCreated === 0) {
    return { ok: true, message: "No new reviews since the last sync" };
  }

  return {
    ok: true,
    message: `${result.reviewsCreated} new ${
      result.reviewsCreated === 1 ? "review" : "reviews"
    } · ${result.escalated} escalated · ${result.templated} templated · ${result.generated} drafted`,
  };
}

export async function setTone(tone: string): Promise<ActionResult> {
  const tenant = await requireTenantForAction();
  if (!isToneName(tone)) return { ok: false, error: "Unknown tone." };

  await prisma.brandVoice.upsert({
    where: { organizationId: tenant.organizationId },
    create: { organizationId: tenant.organizationId, tone },
    update: { tone },
  });

  refresh();
  return { ok: true, message: `Brand voice set to ${tone.toLowerCase()}` };
}

export async function setBrandVoiceDetails(
  alwaysMention: string,
  contactEmail: string,
): Promise<ActionResult> {
  const tenant = await requireTenantForAction();

  await prisma.brandVoice.upsert({
    where: { organizationId: tenant.organizationId },
    create: {
      organizationId: tenant.organizationId,
      alwaysMention: alwaysMention.trim(),
      contactEmail: contactEmail.trim(),
    },
    update: {
      alwaysMention: alwaysMention.trim(),
      contactEmail: contactEmail.trim(),
    },
  });

  refresh();
  return { ok: true, message: "Saved" };
}

export async function setActiveLocation(
  locationId: string,
): Promise<ActionResult> {
  const tenant = await requireTenantForAction();

  const location = await prisma.location.findFirst({
    where: { id: locationId, organizationId: tenant.organizationId },
    select: { id: true, name: true },
  });
  if (!location) return { ok: false, error: "That location is not yours." };

  await prisma.user.update({
    where: { id: tenant.userId },
    data: { activeLocationId: location.id },
  });

  refresh();
  return { ok: true, message: `Now showing ${location.name}` };
}
