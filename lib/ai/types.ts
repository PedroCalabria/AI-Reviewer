import type { ModelName } from "@/lib/config/ai";

/**
 * The only surface the pipeline is allowed to see.
 *
 * Every call is structured: a schema goes in, a parsed object comes out. There
 * is no method here that returns free text, which is what stops anyone
 * downstream from reaching for a regex on a model response.
 */
export interface AiClient {
  /**
   * One structured call. Resolves with the parsed, schema-validated object, or
   * rejects with one of the errors below. Implementations serialize calls and
   * respect the daily budget; callers do not queue or throttle themselves.
   */
  generateStructured<T>(request: StructuredRequest<T>): Promise<T>;

  /** False when today's budget for this model is already spent. */
  hasBudget(model: ModelName): Promise<boolean>;
}

export type StructuredRequest<T> = {
  model: ModelName;
  /** Voice, business facts, and the prohibition list. */
  systemInstruction: string;
  /** The review, and what we want done with it. */
  prompt: string;
  /**
   * An OpenAPI-subset schema, passed to the API as `responseSchema` alongside
   * `responseMimeType: "application/json"`.
   */
  responseSchema: Record<string, unknown>;
  /**
   * Validates the parsed JSON and narrows it. A schema the model satisfies
   * structurally can still be nonsense (an empty reply, a confidence of 40
   * instead of 0.4), so this runs on every response and throwing here is a
   * handled failure, not a crash.
   */
  parse: (raw: unknown) => T;
  /** Names the call in logs, e.g. "classify" or "generate:repair". */
  label: string;
};

/** No API key is configured. The app runs without AI rather than pretending. */
export class AiUnavailableError extends Error {
  readonly kind = "unavailable";
  constructor(message = "No Gemini API key is configured.") {
    super(message);
    this.name = "AiUnavailableError";
  }
}

/** Today's budget for this model is spent. Resets at midnight Pacific. */
export class AiBudgetExhaustedError extends Error {
  readonly kind = "budget";
  constructor(readonly model: string) {
    super(`Daily AI budget for ${model} is exhausted.`);
    this.name = "AiBudgetExhaustedError";
  }
}

/** The call was made and failed: retries exhausted, timeout, or bad output. */
export class AiCallFailedError extends Error {
  readonly kind = "failed";
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "AiCallFailedError";
  }
}

export function isAiError(
  error: unknown,
): error is AiUnavailableError | AiBudgetExhaustedError | AiCallFailedError {
  return (
    error instanceof AiUnavailableError ||
    error instanceof AiBudgetExhaustedError ||
    error instanceof AiCallFailedError
  );
}
