export type Lane = "generated" | "template" | "escalated";

export type ReviewStatus = "needs" | "approved" | "published";

export type ToneName = "Warm" | "Professional" | "Concise" | "Playful";

export type GuardrailCode =
  | "NO_COMPENSATION"
  | "NO_FAULT"
  | "NO_GUARANTEE"
  | "NO_NAMES";

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
  removed: string;
  replaced: string;
};

/** A review as it arrives from the sync, before any desk state is attached. */
export type SeedReview = {
  id: string;
  stars: number;
  name: string;
  initial: string;
  date: string;
  meta: string;
  text: string;
  lane: Lane;
  themes: string[];
  /** Present on the `generated` lane only. */
  draft?: string;
  adjust?: Adjustment;
  /** Present on the `escalated` lane only. */
  category?: string;
  trigger?: string;
  rule?: string;
  escalationCopy?: string;
};

/** A review plus the desk state the operator builds up on it. */
export type Review = SeedReview & {
  status: ReviewStatus;
  /** True once the operator has typed into the draft themselves. */
  edited: boolean;
  /** Index into TEMPLATES, for the `template` lane. */
  variant: number;
  draftText: string;
  /** Transient: the row is animating out of the queue. */
  leaving: boolean;
};

export type LogType = "Sync" | "AI" | "Guardrail" | "Escalation" | "You";

export type LogEntry = {
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
  id: number;
  name: string;
  address: string;
  reviewCount: number;
  unanswered: number;
};
