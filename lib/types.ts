import type { GuardrailCode, ToneName } from "./constants";

export type { GuardrailCode, ToneName };

/**
 * The view model the desk screens render.
 *
 * Deliberately not the Prisma row. The screens want a lane, a formatted date,
 * and a string of reply text; the database has a route, a timestamp, and three
 * draft attempts. Translating once, in lib/view.ts, keeps the formatting out of
 * the components and the presentation out of the schema.
 */

/**
 * Which pane the detail screen shows.
 *
 *   generated  an AI draft that passed the validator
 *   template   canned text for a good rating with nothing written
 *   escalated  no draft, on purpose: a person has to answer this
 *   manual     no draft, because two attempts both broke a guardrail
 *   waiting    not screened yet — the model was unreachable when the sync ran
 */
export type Lane =
  | "generated"
  | "template"
  | "escalated"
  | "manual"
  | "waiting";

export type ReviewStatus = "needs" | "approved" | "published" | "handled";

export type Tone = {
  name: ToneName;
  desc: string;
  example: string;
};

export type Guardrail = {
  code: GuardrailCode;
  text: string;
  example: string;
};

/** What the guardrail pass changed on its way from model output to draft. */
export type Adjustment = {
  note: string;
  rule: GuardrailCode;
  /** The rule as the owner reads it, for the diff heading. */
  ruleLabel: string;
  removed: string;
  replaced: string;
};

/** One rejected generation, kept so the manual lane can show what we tried. */
export type BlockedAttempt = {
  attempt: number;
  text: string;
  /** Human-readable rule names this attempt broke. */
  brokeRules: string[];
};

export type Review = {
  id: string;
  stars: number;
  name: string;
  initial: string;
  /** "Aug 28, 2026" */
  date: string;
  /** "Review 8841 · Aug 28, 2026" */
  meta: string;
  text: string;
  language: string | null;
  lane: Lane;
  themes: string[];
  status: ReviewStatus;

  /** The AI draft as generated, before the operator touched it. */
  draft?: string;
  /** Every repair the validator forced. Usually none, sometimes more than one. */
  adjustments: Adjustment[];
  /** When the draft was written, already formatted: "2 minutes ago". */
  draftedAgo?: string;

  /** Escalated lane. */
  category?: string;
  /** The verbatim span that triggered it. Empty when the classifier failed. */
  trigger?: string;
  triggerSource?: "keyword" | "classifier";
  escalationCopy?: string;

  /** Manual lane. */
  blockedAttempts: BlockedAttempt[];

  /** Template lane. */
  variant: number;
  variantCount: number;

  /** True once the operator has typed into the draft themselves. */
  edited: boolean;
  /** The text in the reply box right now. */
  draftText: string;
  /** Transient: the row is animating out of the queue. */
  leaving: boolean;
};

export type LogType =
  | "Sync"
  | "AI"
  | "Template"
  | "Guardrail"
  | "Escalation"
  | "You";

export type LogEntry = {
  id: string;
  /** "Aug 30 · 09:02" */
  time: string;
  actor: string;
  type: LogType;
  text: string;
};

export type InboxFilter =
  | "Needs review"
  | "Escalated"
  | "Approved"
  | "Published"
  | "All";

export type LogFilter = "All" | LogType;

export type Location = {
  id: string;
  name: string;
  address: string;
  reviewCount: number;
  unanswered: number;
};

export type Account = {
  name: string;
  email: string;
  initials: string;
  /** "Aug 12, 2026" */
  connectedOn: string;
  /** "Google" or "Email and password" */
  method: string;
};

/** What the inbox needs to tell the truth about the automation's state. */
export type AiStatus = {
  configured: boolean;
  exhausted: boolean;
  used: number;
  limit: number;
  /** "midnight Pacific" */
  resetsAt: string;
};

export type SyncStatus = {
  /** "Synced 14 minutes ago", or null when this location has never synced. */
  lastSyncedAgo: string | null;
  /** How the schedule is configured, in words. */
  cadence: string;
  /** Whether replies published here actually reach a customer. */
  publishesForReal: boolean;
  providerName: string;
};

/** Everything the desk needs, resolved on the server in one pass. */
export type DeskData = {
  reviews: Review[];
  log: LogEntry[];
  locations: Location[];
  activeLocationId: string;
  account: Account;
  tone: ToneName;
  alwaysMention: string;
  contactEmail: string;
  ai: AiStatus;
  sync: SyncStatus;
};
