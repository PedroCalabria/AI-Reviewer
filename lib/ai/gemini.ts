import { GoogleGenAI } from "@google/genai";
import {
  budgetDayKey,
  MODELS,
  CALL_TIMEOUT_MS,
  DAILY_BUDGET,
  MIN_CALL_INTERVAL_MS,
  RETRY,
  type ModelName,
} from "@/lib/config/ai";
import { prisma } from "@/lib/db";
import {
  AiBudgetExhaustedError,
  AiCallFailedError,
  AiUnavailableError,
  type AiClient,
  type StructuredRequest,
} from "./types";

/**
 * The Gemini API client, built for a free tier whose numbers are not published
 * and do move:
 *
 *   * Calls are serialized behind one promise chain with a minimum gap between
 *     them. Nothing in this app ever fans out parallel LLM requests, so the
 *     requests-per-minute limit is handled by construction rather than by
 *     reacting to 429s.
 *   * A daily counter in the database is checked before each call and
 *     incremented after it. When the budget is spent the call is refused with a
 *     typed error the UI can render, and template routing keeps working because
 *     it costs nothing.
 *   * 429 and 5xx get exponential backoff with jitter, capped. After that the
 *     call fails with a readable reason instead of retrying forever.
 *   * A 429 that names a daily quota is believed over our own configuration,
 *     and stops the day rather than being retried into.
 */

function apiKey(): string | undefined {
  return process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() || undefined;
}

export function isAiConfigured(): boolean {
  return apiKey() !== undefined;
}

let client: GoogleGenAI | null = null;

function genai(): GoogleGenAI {
  const key = apiKey();
  if (!key) throw new AiUnavailableError();
  if (!client) client = new GoogleGenAI({ apiKey: key });
  return client;
}

// --- The serial queue --------------------------------------------------------

/**
 * Every call joins the tail of this chain, so call N+1 cannot start until call
 * N has finished and the minimum interval has elapsed. The chain is per-process
 * — which is the right scope, because the sync job that does the bulk of the
 * calling runs in one process.
 */
let queueTail: Promise<unknown> = Promise.resolve();
let lastCallStartedAt = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function enqueue<T>(work: () => Promise<T>): Promise<T> {
  const run = queueTail.then(async () => {
    const sinceLast = Date.now() - lastCallStartedAt;
    const wait = MIN_CALL_INTERVAL_MS - sinceLast;
    if (wait > 0) await sleep(wait);
    lastCallStartedAt = Date.now();
    return work();
  });
  // Keep the chain alive even when a call rejects, or one failure would wedge
  // every call behind it.
  queueTail = run.catch(() => undefined);
  return run;
}

// --- Retry -------------------------------------------------------------------

/**
 * The daily limit Google actually enforces, learned from a 429.
 *
 * A quota-exceeded response names the limit exactly:
 *
 *   "Quota exceeded for metric: …/generate_content_free_tier_requests,
 *    limit: 20, model: gemini-3.5-flash"
 *
 * and repeats it as a structured QuotaFailure violation. Reading it beats
 * guessing: the free tier moves, and being wrong in the optimistic direction
 * means the app spends its afternoon collecting 429s instead of telling the
 * owner drafting is paused. Held in memory for the process — it is a cache for
 * the day's pacing, not a fact worth a migration.
 */
const discoveredLimits = new Map<string, number>();

function learnQuotaFrom(error: unknown, model: string): number | null {
  const message = error instanceof Error ? error.message : String(error ?? "");

  // The structured violation, when the SDK preserved it.
  const structured = /"quotaValue"\s*:\s*"?(\d+)"?/.exec(message);
  // The prose form, which is always present.
  const prose = /limit:\s*(\d+)/i.exec(message);

  const raw = structured?.[1] ?? prose?.[1];
  if (!raw) return null;

  const limit = Number.parseInt(raw, 10);
  if (!Number.isFinite(limit) || limit <= 0) return null;

  // Per-minute quotas name the same way; only a daily one should shrink the
  // day's budget.
  if (/PerMinute/i.test(message) && !/PerDay/i.test(message)) return null;

  if (discoveredLimits.get(model) !== limit) {
    discoveredLimits.set(model, limit);
    console.warn(
      `[ai] ${model}: the free tier reports a daily limit of ${limit}. Budgeting against that.`,
    );
  }

  return limit;
}

/**
 * Bring the counter up to the limit Google just reported.
 *
 * Our count can legitimately be lower — another process on the same key, or a
 * day that started before this deployment. Once the API has said the day is
 * spent, the counter should agree, so the rest of the run stops asking.
 */
async function markBudgetSpent(model: ModelName, limit: number): Promise<void> {
  const day = budgetDayKey();
  await prisma.aiUsageCounter.upsert({
    where: { day_model: { day, model } },
    create: { day, model, calls: limit },
    update: { calls: limit },
  });
}

/** The budget we are actually pacing against for this model today. */
function effectiveLimit(model: ModelName): number {
  const discovered = discoveredLimits.get(model);
  const configured = DAILY_BUDGET[model];
  return discovered !== undefined
    ? Math.min(discovered, configured)
    : configured;
}

function statusOf(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const candidate = error as { status?: unknown; code?: unknown };
  const raw = candidate.status ?? candidate.code;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) return parsed;
  }
  // The SDK sometimes only carries the status in the message.
  const message = error instanceof Error ? error.message : "";
  if (/\b429\b|RESOURCE_EXHAUSTED|rate limit/i.test(message)) return 429;
  if (/\b50[0-9]\b|UNAVAILABLE|INTERNAL/i.test(message)) return 503;
  return undefined;
}

function isRetryable(error: unknown): boolean {
  const status = statusOf(error);
  return status === 429 || (status !== undefined && status >= 500);
}

function backoffMs(attempt: number): number {
  const exponential = RETRY.baseDelayMs * 2 ** (attempt - 1);
  const capped = Math.min(exponential, RETRY.maxDelayMs);
  return Math.round(capped * (1 + Math.random() * RETRY.jitterRatio));
}

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(
          new AiCallFailedError(
            `The ${label} call did not answer within ${Math.round(CALL_TIMEOUT_MS / 1000)}s.`,
          ),
        ),
      CALL_TIMEOUT_MS,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

// --- Budget ------------------------------------------------------------------

async function callsUsedToday(model: ModelName): Promise<number> {
  const row = await prisma.aiUsageCounter.findUnique({
    where: { day_model: { day: budgetDayKey(), model } },
  });
  return row?.calls ?? 0;
}

async function recordCall(model: ModelName): Promise<void> {
  const day = budgetDayKey();
  await prisma.aiUsageCounter.upsert({
    where: { day_model: { day, model } },
    create: { day, model, calls: 1 },
    update: { calls: { increment: 1 } },
  });
}

/** What the UI needs to render the "AI drafts paused" state. */
export async function budgetStatus(): Promise<{
  configured: boolean;
  exhausted: boolean;
  used: number;
  limit: number;
}> {
  // The generation budget is the one the operator cares about: it is what
  // stops drafts appearing.
  const model = MODELS.generation;
  const limit = effectiveLimit(model);
  const used = isAiConfigured() ? await callsUsedToday(model) : 0;
  return {
    configured: isAiConfigured(),
    exhausted: isAiConfigured() && used >= limit,
    used,
    limit,
  };
}

// --- The client --------------------------------------------------------------

export class GeminiClient implements AiClient {
  async hasBudget(model: ModelName): Promise<boolean> {
    if (!isAiConfigured()) return false;
    return (await callsUsedToday(model)) < effectiveLimit(model);
  }

  async generateStructured<T>(request: StructuredRequest<T>): Promise<T> {
    if (!isAiConfigured()) throw new AiUnavailableError();

    const { model, label } = request;
    if ((await callsUsedToday(model)) >= effectiveLimit(model)) {
      throw new AiBudgetExhaustedError(model);
    }

    return enqueue(() => this.callWithRetries(request, label));
  }

  private async callWithRetries<T>(
    request: StructuredRequest<T>,
    label: string,
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= RETRY.maxAttempts; attempt++) {
      try {
        const response = await withTimeout(
          genai().models.generateContent({
            model: request.model,
            contents: request.prompt,
            config: {
              systemInstruction: request.systemInstruction,
              responseMimeType: "application/json",
              responseSchema: request.responseSchema,
              temperature: 0.7,
            },
          }),
          label,
        );

        // Count the call the moment the API answers, whatever the body says.
        // A response we cannot use still spent quota.
        await recordCall(request.model);

        const text = response.text;
        if (!text) {
          throw new AiCallFailedError(
            `The ${label} call returned no content. It was most likely stopped by a safety filter.`,
          );
        }

        let parsed: unknown;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new AiCallFailedError(
            `The ${label} call returned text that is not valid JSON.`,
          );
        }

        return request.parse(parsed);
      } catch (error) {
        lastError = error;

        if (statusOf(error) === 429) {
          const learned = learnQuotaFrom(error, request.model);

          // A daily cap will not clear by waiting thirty seconds. Retrying into
          // one just burns the backoff budget to arrive at the same answer, so
          // record the day as spent and let the UI say drafting is paused.
          if (learned) {
            await markBudgetSpent(request.model, learned);
            throw new AiBudgetExhaustedError(request.model);
          }

          if ((await callsUsedToday(request.model)) >= effectiveLimit(request.model)) {
            throw new AiBudgetExhaustedError(request.model);
          }
        }

        // A bad body will be bad again; only transport failures are worth a retry.
        if (!isRetryable(error) || attempt === RETRY.maxAttempts) break;

        await sleep(backoffMs(attempt));
      }
    }

    if (lastError instanceof AiCallFailedError) throw lastError;

    const status = statusOf(lastError);
    const reason =
      status === 429
        ? `rate limited after ${RETRY.maxAttempts} attempts`
        : status
          ? `HTTP ${status} after ${RETRY.maxAttempts} attempts`
          : lastError instanceof Error
            ? lastError.message
            : "unknown error";

    throw new AiCallFailedError(`The ${label} call failed: ${reason}.`, lastError);
  }
}

let singleton: AiClient | null = null;

export function aiClient(): AiClient {
  if (!singleton) singleton = new GeminiClient();
  return singleton;
}
