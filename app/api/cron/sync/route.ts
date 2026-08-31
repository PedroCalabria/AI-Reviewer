import { NextResponse } from "next/server";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/db";
import { drainQueue, enqueueSync } from "@/lib/sync/runSync";

/**
 * The scheduled sync trigger.
 *
 * Called by the GitHub Actions workflow in .github/workflows/sync.yml. Vercel's
 * Hobby plan only allows a cron job once a day, so the schedule lives in
 * Actions instead — free, any frequency, and it demonstrates the same
 * external-trigger pattern. See the README.
 *
 * Protected by a shared secret. There is no unauthenticated path through this
 * handler: a missing or wrong secret is a 401 before anything is read.
 */

// Syncing 50 reviews with rate-limited model calls takes minutes, not seconds.
export const maxDuration = 300;
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET;

  // An unset secret must never mean "let everyone in".
  if (!expected) return false;

  const header =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer /i, "") ??
    "";

  // Length check first so the comparison below is over equal-length strings.
  if (header.length !== expected.length) return false;

  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) {
    mismatch |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function POST(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const locations = await prisma.location.findMany({
    select: { id: true, name: true, organizationId: true },
  });

  if (locations.length === 0) {
    return NextResponse.json({ ok: true, locations: 0, results: [] });
  }

  for (const location of locations) {
    await enqueueSync(location.id, "scheduled");
    await logActivity({
      organizationId: location.organizationId,
      locationId: location.id,
      type: "Sync",
      actor: "System",
      message: `Scheduled sync queued for ${location.name}`,
    });
  }

  // Drained in one pass, serialized, so the LLM queue behind it is never
  // running two locations' worth of calls at once.
  const results = await drainQueue();

  return NextResponse.json({
    ok: results.every((r) => r.status === "succeeded"),
    locations: locations.length,
    results,
  });
}

/** A GET is handy for checking the secret is wired up without running a sync. */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [locations, lastSync] = await Promise.all([
    prisma.location.count(),
    prisma.syncJob.findFirst({
      where: { status: "succeeded" },
      orderBy: { finishedAt: "desc" },
      select: { finishedAt: true, trigger: true },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    locations,
    lastSuccessfulSync: lastSync?.finishedAt ?? null,
    lastTrigger: lastSync?.trigger ?? null,
  });
}
