import { aiClient } from "@/lib/ai/gemini";
import type { ClassifierResult } from "@/lib/ai/schemas";
import { logActivity } from "@/lib/activity";
import { isToneName, type SyncTrigger } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { runPipeline, type PipelineContext } from "@/lib/pipeline";
import { getReviewProvider } from "@/lib/providers";
import { applyOutcome } from "./apply";

/**
 * The sync job.
 *
 * A database table and a function. No Redis, no broker, no worker process —
 * for a queue whose depth is "one location's new reviews", those would be
 * infrastructure to maintain rather than a problem solved.
 *
 * Three properties matter and each is load-bearing:
 *
 *   Idempotent   Reviews carry the provider's external ID under a unique
 *                constraint scoped to the location, so a re-run updates in
 *                place. Triage only touches reviews that have no route yet, so
 *                a re-run never re-drafts and never re-spends budget.
 *   Incremental  Fetching is bounded by the location's watermark rather than
 *                walking the table.
 *   Observable   Every step writes to the activity log.
 */

export type SyncResult = {
  jobId: string;
  status: "succeeded" | "failed";
  reviewsFetched: number;
  reviewsCreated: number;
  reviewsUpdated: number;
  escalated: number;
  templated: number;
  generated: number;
  failed: number;
  error?: string;
};

/** Puts a job on the queue. Returns immediately; draining is separate. */
export async function enqueueSync(
  locationId: string,
  trigger: SyncTrigger = "manual",
): Promise<string> {
  const job = await prisma.syncJob.create({
    data: { locationId, trigger, status: "queued" },
  });
  return job.id;
}

/**
 * Runs every queued job for a location, oldest first.
 *
 * Serialized on purpose: two syncs of the same location at once would both
 * fetch the same reviews and race on the watermark, and the LLM queue behind
 * them would be shared anyway.
 */
export async function drainQueue(locationId?: string): Promise<SyncResult[]> {
  const results: SyncResult[] = [];

  for (;;) {
    const next = await prisma.syncJob.findFirst({
      where: { status: "queued", ...(locationId ? { locationId } : {}) },
      orderBy: { queuedAt: "asc" },
    });
    if (!next) break;

    results.push(await runSyncJob(next.id));
  }

  return results;
}

export async function runSyncJob(jobId: string): Promise<SyncResult> {
  const job = await prisma.syncJob.findUniqueOrThrow({
    where: { id: jobId },
    include: {
      location: {
        include: {
          organization: { include: { brandVoice: true } },
        },
      },
    },
  });

  const { location } = job;
  const { organization } = location;

  const counts = {
    reviewsFetched: 0,
    reviewsCreated: 0,
    reviewsUpdated: 0,
    escalated: 0,
    templated: 0,
    generated: 0,
    failed: 0,
  };

  await prisma.syncJob.update({
    where: { id: jobId },
    data: { status: "running", startedAt: new Date() },
  });

  try {
    const provider = getReviewProvider();

    // --- Ingest ------------------------------------------------------------
    const incoming = await provider.fetchReviews(location.externalId, {
      since: location.syncWatermark ?? undefined,
    });
    counts.reviewsFetched = incoming.length;

    let watermark = location.syncWatermark ?? new Date(0);

    for (const review of incoming) {
      const existing = await prisma.review.findUnique({
        where: {
          locationId_externalId: {
            locationId: location.id,
            externalId: review.externalId,
          },
        },
        select: { id: true },
      });

      await prisma.review.upsert({
        where: {
          locationId_externalId: {
            locationId: location.id,
            externalId: review.externalId,
          },
        },
        create: {
          locationId: location.id,
          externalId: review.externalId,
          authorName: review.authorName,
          rating: review.rating,
          text: review.text,
          language: review.language ?? null,
          postedAt: review.postedAt,
          providerUpdatedAt: review.updatedAt,
        },
        update: {
          // A customer can edit a review. Update the content, but never touch
          // the triage columns — re-triage is decided below, deliberately.
          authorName: review.authorName,
          rating: review.rating,
          text: review.text,
          providerUpdatedAt: review.updatedAt,
        },
      });

      if (existing) counts.reviewsUpdated++;
      else counts.reviewsCreated++;

      if (review.updatedAt > watermark) watermark = review.updatedAt;
    }

    await prisma.location.update({
      where: { id: location.id },
      data: { syncWatermark: watermark },
    });

    if (counts.reviewsCreated > 0 || counts.reviewsUpdated > 0) {
      await logActivity({
        organizationId: organization.id,
        locationId: location.id,
        type: "Sync",
        actor: "System",
        message:
          counts.reviewsCreated > 0
            ? `Synced ${counts.reviewsCreated} new ${counts.reviewsCreated === 1 ? "review" : "reviews"} from ${location.name}`
            : `Synced ${location.name} — ${counts.reviewsUpdated} ${counts.reviewsUpdated === 1 ? "review was" : "reviews were"} edited`,
      });
    }

    // --- Triage ------------------------------------------------------------
    const brandVoice = organization.brandVoice;
    const tone =
      brandVoice && isToneName(brandVoice.tone) ? brandVoice.tone : "Warm";

    const ctxBase = {
      ai: aiClient(),
      businessName: organization.name,
      brandVoice: {
        tone,
        alwaysMention: brandVoice?.alwaysMention ?? "",
        contactEmail: brandVoice?.contactEmail ?? "",
      },
    };

    // Only reviews that have never been triaged. This is what makes a re-run
    // free: a second sync finds nothing to route and calls no models.
    const untriaged = await prisma.review.findMany({
      where: { locationId: location.id, route: null },
      orderBy: { postedAt: "desc" },
    });

    for (const review of untriaged) {
      // Calls are serialized inside the AI client, so this loop stays a loop.
      // Fanning it out would be the fastest way to spend a day's free tier in
      // ninety seconds.
      const cached: ClassifierResult | null = review.classifiedAt
        ? {
            category: (review.classifierCategory ??
              "NONE") as ClassifierResult["category"],
            confidence: review.classifierConfidence ?? 0,
            evidence: review.escalationEvidence ?? "",
          }
        : null;

      const ctx: PipelineContext = { ...ctxBase, cachedClassification: cached };

      const outcome = await runPipeline(
        {
          id: review.externalId,
          rating: review.rating,
          text: review.text,
          authorName: review.authorName,
        },
        ctx,
      );

      await applyOutcome(
        {
          id: review.id,
          organizationId: organization.id,
          locationId: location.id,
          authorName: review.authorName,
        },
        outcome,
      );

      if (outcome.route === "ESCALATE") counts.escalated++;
      else if (outcome.route === "TEMPLATE") counts.templated++;
      else if (outcome.outcome === "drafted") counts.generated++;
      else counts.failed++;
    }

    await prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: "succeeded",
        finishedAt: new Date(),
        reviewsFetched: counts.reviewsFetched,
        reviewsCreated: counts.reviewsCreated,
        reviewsUpdated: counts.reviewsUpdated,
        escalatedCount: counts.escalated,
        templatedCount: counts.templated,
        generatedCount: counts.generated,
        failedCount: counts.failed,
      },
    });

    return { jobId, status: "succeeded", ...counts };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown sync failure.";

    await prisma.syncJob.update({
      where: { id: jobId },
      data: { status: "failed", finishedAt: new Date(), error: message },
    });

    await logActivity({
      organizationId: organization.id,
      locationId: location.id,
      type: "Sync",
      actor: "System",
      message: `Sync of ${location.name} failed — ${message}`,
    });

    return { jobId, status: "failed", ...counts, error: message };
  }
}

/** Enqueue and drain in one call, for the `Sync now` button. */
export async function syncNow(
  locationId: string,
  trigger: SyncTrigger = "manual",
): Promise<SyncResult> {
  const jobId = await enqueueSync(locationId, trigger);
  const [result] = await drainQueue(locationId);
  return (
    result ?? {
      jobId,
      status: "failed",
      reviewsFetched: 0,
      reviewsCreated: 0,
      reviewsUpdated: 0,
      escalated: 0,
      templated: 0,
      generated: 0,
      failed: 0,
      error: "The job was queued but did not run.",
    }
  );
}
