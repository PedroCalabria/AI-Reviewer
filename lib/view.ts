import { budgetStatus } from "@/lib/ai/gemini";
import { BUDGET_RESET_LABEL } from "@/lib/config/ai";
import {
  categoryExplanation,
  categoryLabel,
} from "@/lib/config/escalation";
import { TEMPLATE_VARIANT_COUNT } from "@/lib/config/templates";
import { guardrailFor } from "@/lib/config/voice";
import { isToneName, type GuardrailCode } from "@/lib/constants";
import { prisma } from "@/lib/db";
import {
  initialOf,
  initialsOf,
  logStamp,
  relativeTime,
  reviewNumber,
  shortDate,
} from "@/lib/format";
import { getReviewProvider } from "@/lib/providers";
import type { Tenant } from "@/lib/tenancy";
import type {
  BlockedAttempt,
  DeskData,
  Lane,
  LogEntry,
  LogType,
  Review,
  ReviewStatus,
} from "@/lib/types";

/**
 * Database rows to view models.
 *
 * Every read the desk does goes through here, and every query is scoped by the
 * organization ID on the Tenant it is handed — which came from the session, not
 * from a request. See lib/tenancy.ts.
 */

const SCHEDULE_CADENCE =
  process.env.SYNC_CADENCE_LABEL ?? "Every six hours, plus whenever you ask";

function laneOf(row: {
  route: string | null;
  status: string;
}): Lane {
  if (row.status === "NEEDS_MANUAL_REPLY") return "manual";
  if (row.route === "ESCALATE") return "escalated";
  if (row.route === "TEMPLATE") return "template";
  if (row.route === "GENERATE") return "generated";
  // No route yet: the escalation gate could not run when this was synced.
  return "waiting";
}

function statusOf(status: string): ReviewStatus {
  switch (status) {
    case "PUBLISHED":
      return "published";
    case "APPROVED":
      return "approved";
    case "HANDLED_EXTERNALLY":
      return "handled";
    default:
      return "needs";
  }
}

function parseThemes(json: string): string[] {
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

function ruleLabel(code: string): string {
  try {
    return guardrailFor(code as GuardrailCode).text;
  } catch {
    return code;
  }
}

type ReviewRow = Awaited<ReturnType<typeof fetchReviewRows>>[number];

function fetchReviewRows(locationId: string) {
  return prisma.review.findMany({
    where: { locationId },
    orderBy: { postedAt: "desc" },
    include: {
      drafts: { orderBy: { attempt: "asc" } },
      guardrailEvents: { orderBy: { createdAt: "asc" } },
    },
  });
}

function toReview(row: ReviewRow, now: Date): Review {
  const lane = laneOf(row);
  const current = row.drafts.find((d) => d.isCurrent);

  const repaired = row.guardrailEvents.filter((e) => e.outcome === "REPAIRED");
  const blocked = row.guardrailEvents.filter((e) => e.outcome === "FAILED");

  const blockedAttempts: BlockedAttempt[] =
    lane === "manual"
      ? row.drafts.map((draft) => ({
          attempt: draft.attempt,
          text: draft.rawOutput,
          brokeRules: [
            ...new Set(
              blocked
                .filter((e) => e.draftId === draft.id)
                .map((e) => ruleLabel(e.code)),
            ),
          ],
        }))
      : [];

  const machineText = current?.validatedOutput ?? current?.rawOutput ?? "";
  const edited = Boolean(current?.humanEdited);

  return {
    id: row.id,
    stars: row.rating,
    name: row.authorName,
    initial: initialOf(row.authorName),
    date: shortDate(row.postedAt),
    meta: `${reviewNumber(row.externalId)} · ${shortDate(row.postedAt)}`,
    text: row.text,
    language: row.language,
    lane,
    themes: parseThemes(row.themesJson),
    status: statusOf(row.status),

    draft: machineText || undefined,
    draftedAgo: current ? relativeTime(current.createdAt, now) : undefined,
    adjustments: repaired.map((event) => ({
      note: event.note,
      rule: event.code as GuardrailCode,
      ruleLabel: ruleLabel(event.code),
      removed: event.removedText ?? event.excerpt,
      replaced: event.replacedText ?? "",
    })),

    category: row.escalationCategory
      ? categoryLabel(row.escalationCategory)
      : lane === "escalated"
        ? "Needs a person"
        : undefined,
    trigger: row.escalationEvidence || undefined,
    triggerSource:
      (row.escalationTrigger as "keyword" | "classifier" | null) ?? undefined,
    escalationCopy:
      lane === "escalated"
        ? categoryExplanation(row.escalationCategory)
        : undefined,

    blockedAttempts,

    variant: row.templateVariant ?? 0,
    variantCount: TEMPLATE_VARIANT_COUNT,

    edited,
    draftText: current?.humanEdited ?? machineText,
    leaving: false,
  };
}

function toLogEntry(row: {
  id: string;
  createdAt: Date;
  actor: string;
  type: string;
  message: string;
}): LogEntry {
  return {
    id: row.id,
    time: logStamp(row.createdAt),
    actor: row.actor,
    type: row.type as LogType,
    text: row.message,
  };
}

/** Everything the desk screens need, in one server-side pass. */
export async function loadDeskData(
  tenant: Tenant & { activeLocationId: string },
): Promise<DeskData> {
  const now = new Date();

  const [rows, logRows, locationRows, brandVoice, lastSync, ai, account] =
    await Promise.all([
      fetchReviewRows(tenant.activeLocationId),
      prisma.activityLog.findMany({
        where: { organizationId: tenant.organizationId },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.location.findMany({
        where: { organizationId: tenant.organizationId },
        orderBy: { createdAt: "asc" },
        include: {
          _count: { select: { reviews: true } },
        },
      }),
      prisma.brandVoice.findUnique({
        where: { organizationId: tenant.organizationId },
      }),
      prisma.syncJob.findFirst({
        where: {
          locationId: tenant.activeLocationId,
          status: "succeeded",
        },
        orderBy: { finishedAt: "desc" },
      }),
      budgetStatus(),
      prisma.user.findUnique({
        where: { id: tenant.userId },
        include: { accounts: { select: { provider: true } } },
      }),
    ]);

  const unanswered = await prisma.review.groupBy({
    by: ["locationId"],
    where: {
      locationId: { in: locationRows.map((l) => l.id) },
      status: { in: ["NEEDS_REVIEW", "NEEDS_MANUAL_REPLY"] },
    },
    _count: true,
  });

  const unansweredBy = new Map(
    unanswered.map((row) => [row.locationId, row._count]),
  );

  const provider = getReviewProvider();

  return {
    reviews: rows.map((row) => toReview(row, now)),
    log: logRows.map(toLogEntry),
    locations: locationRows.map((location) => ({
      id: location.id,
      name: location.name,
      address: location.address,
      reviewCount: location._count.reviews,
      unanswered: unansweredBy.get(location.id) ?? 0,
    })),
    activeLocationId: tenant.activeLocationId,
    account: {
      name: account?.name ?? tenant.userName,
      email: account?.email ?? tenant.userEmail,
      initials: initialsOf(
        account?.name ?? tenant.userName,
        account?.email ?? tenant.userEmail,
      ),
      connectedOn: account ? shortDate(account.createdAt) : "",
      method: account?.accounts.some((a) => a.provider === "google")
        ? "Google"
        : "Email and password",
    },
    tone:
      brandVoice && isToneName(brandVoice.tone) ? brandVoice.tone : "Warm",
    alwaysMention: brandVoice?.alwaysMention ?? "",
    contactEmail: brandVoice?.contactEmail ?? "",
    ai: {
      configured: ai.configured,
      exhausted: ai.exhausted,
      used: ai.used,
      limit: ai.limit,
      resetsAt: BUDGET_RESET_LABEL,
    },
    sync: {
      lastSyncedAgo: lastSync?.finishedAt
        ? relativeTime(lastSync.finishedAt, now)
        : null,
      cadence: SCHEDULE_CADENCE,
      publishesForReal: provider.publishesForReal,
      providerName: provider.name,
    },
  };
}
