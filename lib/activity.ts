import type { ActivityType } from "@/lib/constants";
import { prisma } from "@/lib/db";
import type { PrismaClient } from "@/lib/generated/prisma/client";

/**
 * The activity log.
 *
 * The rule this exists to serve: the user must be able to see what the
 * automation did without reading server logs. Every step of a sync writes here
 * — what was fetched, what was escalated and why, what was drafted, what a
 * guardrail rewrote, what was published and where it actually went.
 */

export type ActivityInput = {
  organizationId: string;
  locationId?: string | null;
  reviewId?: string | null;
  type: ActivityType;
  /** "System", "AI", "Guardrail", or a person's name. */
  actor: string;
  message: string;
};

/** Accepts a transaction client so a log entry can share a write's atomicity. */
type Db = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

export async function logActivity(
  entry: ActivityInput,
  db: Db = prisma,
): Promise<void> {
  await db.activityLog.create({
    data: {
      organizationId: entry.organizationId,
      locationId: entry.locationId ?? null,
      reviewId: entry.reviewId ?? null,
      type: entry.type,
      actor: entry.actor,
      message: entry.message,
    },
  });
}

export async function logMany(
  entries: ActivityInput[],
  db: Db = prisma,
): Promise<void> {
  if (!entries.length) return;
  await db.activityLog.createMany({
    data: entries.map((entry) => ({
      organizationId: entry.organizationId,
      locationId: entry.locationId ?? null,
      reviewId: entry.reviewId ?? null,
      type: entry.type,
      actor: entry.actor,
      message: entry.message,
    })),
  });
}
