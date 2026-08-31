/**
 * The closed sets the database stores as plain strings.
 *
 * SQLite has no enum type, so the schema uses String columns and these unions
 * are the enforcement. Every value written to one of those columns should come
 * from here rather than from a string literal at the call site.
 */

export const REVIEW_STATUSES = [
  "NEEDS_REVIEW",
  "APPROVED",
  "PUBLISHED",
  /** The operator answered outside the tool; nothing was published by us. */
  "HANDLED_EXTERNALLY",
  /** Generation was attempted twice and both attempts broke a guardrail. */
  "NEEDS_MANUAL_REPLY",
] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const TRIAGE_ROUTES = ["ESCALATE", "TEMPLATE", "GENERATE"] as const;
export type TriageRouteName = (typeof TRIAGE_ROUTES)[number];

export const ESCALATION_CATEGORIES = [
  "LEGAL_THREAT",
  "HEALTH_SAFETY",
  "DISCRIMINATION",
  "PHYSICAL_HARM",
  "STAFF_MISCONDUCT",
  "MINOR_SAFETY",
  "NONE",
] as const;
export type EscalationCategory = (typeof ESCALATION_CATEGORIES)[number];

/** Every category except NONE routes a review to a human. */
export type EscalatableCategory = Exclude<EscalationCategory, "NONE">;

export const ESCALATION_TRIGGERS = ["keyword", "classifier"] as const;
export type EscalationTrigger = (typeof ESCALATION_TRIGGERS)[number];

export const DRAFT_SOURCES = ["AI", "TEMPLATE", "HUMAN"] as const;
export type DraftSource = (typeof DRAFT_SOURCES)[number];

/**
 * The four prohibitions. These codes are also what the settings screen renders,
 * so they are product vocabulary, not just internal identifiers.
 */
export const GUARDRAIL_CODES = [
  "NO_COMPENSATION",
  "NO_FAULT",
  "NO_GUARANTEE",
  "NO_NAMES",
] as const;
export type GuardrailCode = (typeof GUARDRAIL_CODES)[number];

export const GUARDRAIL_OUTCOMES = ["REPAIRED", "FAILED"] as const;
export type GuardrailOutcome = (typeof GUARDRAIL_OUTCOMES)[number];

export const SYNC_STATUSES = [
  "queued",
  "running",
  "succeeded",
  "failed",
] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export const SYNC_TRIGGERS = ["manual", "scheduled"] as const;
export type SyncTrigger = (typeof SYNC_TRIGGERS)[number];

export const ACTIVITY_TYPES = [
  "Sync",
  "AI",
  "Template",
  "Guardrail",
  "Escalation",
  "You",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const TONE_NAMES = [
  "Warm",
  "Professional",
  "Concise",
  "Playful",
] as const;
export type ToneName = (typeof TONE_NAMES)[number];

export function isToneName(value: string): value is ToneName {
  return (TONE_NAMES as readonly string[]).includes(value);
}
