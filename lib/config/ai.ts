/**
 * Model selection and free-tier budget.
 *
 * Both models run on the Gemini API with a Google AI Studio key, which has a
 * free tier that needs no card. The split is deliberate:
 *
 *   * The escalation classifier runs on EVERY review that survives the keyword
 *     gate, so it goes on the smaller, cheaper model. It answers one narrow
 *     question and does not need the larger model to answer it well.
 *   * Reply generation runs on far fewer reviews and is the output a human
 *     reads, so it gets the better model.
 *
 * Changing either is a one-line change here; nothing else names a model.
 *
 * On the versions, because the brief named two models that no longer work:
 *
 *   * gemini-2.5-flash and gemini-2.5-flash-lite are not issued to new API
 *     keys at all. The API answers with a 404 pointing at the 3.5 line.
 *   * gemini-3.5-flash is capped at **20 requests per day** on the free tier —
 *     measured, not guessed; the 429 names the quota. Twenty drafts a day is
 *     not a product, so generation runs on the lite model instead.
 *
 * Quotas are per model per day, so putting the two jobs on *different* models
 * is what keeps classification from eating the drafting budget. That was the
 * point of the split in the first place; only the model names changed.
 */
export const MODELS = {
  /** Reply generation. */
  generation: "gemini-3.5-flash-lite",
  /** Escalation classification. */
  classifier: "gemini-3.1-flash-lite",
} as const;

export type ModelName = (typeof MODELS)[keyof typeof MODELS];

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function envFloat(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Daily call ceilings, per model.
 *
 * These are OUR budget, not Google's quota. Google no longer publishes
 * per-model free-tier numbers in the docs — they are per account in AI Studio
 * and they move — so any number written here is a guess with a shelf life. The
 * first version of this file guessed 200 for the generation model; the real
 * figure for gemini-3.5-flash turned out to be 20.
 *
 * So the number here is only a starting point. The client reads the true limit
 * out of the first 429 it gets, which states it exactly, and from then on
 * budgets against that instead. See `discoveredLimit` in lib/ai/gemini.ts.
 */
export const DAILY_BUDGET: Record<ModelName, number> = {
  [MODELS.generation]: envInt("AI_DAILY_BUDGET_GENERATION", 150),
  [MODELS.classifier]: envInt("AI_DAILY_BUDGET_CLASSIFIER", 150),
};

/**
 * Minimum wall-clock gap between two calls to the Gemini API.
 *
 * The queue is serialized — we never fan out parallel LLM requests — so this is
 * the whole of the requests-per-minute story. 6.5s is about 9 calls a minute,
 * which stays under a 10 RPM ceiling without needing to know the exact number.
 */
export const MIN_CALL_INTERVAL_MS = envInt("AI_MIN_DELAY_MS", 6500);

/** Retry policy for 429s and transient 5xx. */
export const RETRY = {
  maxAttempts: envInt("AI_MAX_RETRIES", 4),
  baseDelayMs: envInt("AI_RETRY_BASE_MS", 2000),
  maxDelayMs: envInt("AI_RETRY_MAX_MS", 32000),
  /** Random fraction of the delay added on top, so retries do not synchronize. */
  jitterRatio: 0.3,
} as const;

/** How long a single model call may run before we give up on it. */
export const CALL_TIMEOUT_MS = envInt("AI_TIMEOUT_MS", 30000);

/**
 * The classifier escalates at or above this confidence.
 *
 * Set low on purpose. A false escalation costs the owner a minute; a missed one
 * can cost a lawsuit. The gate is tuned for recall, and the keyword list runs
 * alongside it as a union rather than a filter.
 */
export const ESCALATION_CONFIDENCE_THRESHOLD = envFloat(
  "AI_ESCALATION_THRESHOLD",
  0.4,
);

/**
 * The Gemini free tier's daily quota resets at midnight Pacific, not UTC, so
 * the usage counter is keyed by the Pacific date and the UI quotes that time.
 */
export const BUDGET_RESET_TIME_ZONE = "America/Los_Angeles";

/** The YYYY-MM-DD key the AiUsageCounter rows are bucketed by. */
export function budgetDayKey(at: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD, which sorts and compares correctly as a string.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BUDGET_RESET_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/** Human-readable reset time for the "AI drafts paused" notice. */
export const BUDGET_RESET_LABEL = "midnight Pacific";
