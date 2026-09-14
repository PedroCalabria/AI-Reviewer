import type {
  EscalatableCategory,
  EscalationCategory,
} from "@/lib/constants";

/**
 * The escalation gate's vocabulary: what each category is called on screen,
 * what we say to the owner when it fires, and which literal phrases trip it
 * without any model involvement.
 */

type CategoryCopy = {
  /** Shown on the escalated slab and in the inbox row. */
  label: string;
  /** The paragraph under "We didn't draft a reply." on the detail screen. */
  explanation: string;
  /** One line for the activity log. */
  logReason: string;
};

export const ESCALATION_COPY: Record<EscalatableCategory, CategoryCopy> = {
  LEGAL_THREAT: {
    label: "Legal threat",
    explanation:
      "This review mentions a legal threat, and an automated response could work against you. Write this one yourself, or forward it.",
    logReason: "legal threat detected",
  },
  HEALTH_SAFETY: {
    label: "Health and safety",
    explanation:
      "This review makes a health and safety claim, and an automated response could work against you. Write this one yourself, or forward it.",
    logReason: "health and safety claim detected",
  },
  DISCRIMINATION: {
    label: "Discrimination",
    explanation:
      "This review implies discrimination, and an automated response could work against you. Write this one yourself, or forward it.",
    logReason: "discrimination detected",
  },
  PHYSICAL_HARM: {
    label: "Physical harm",
    explanation:
      "This review describes someone being hurt, and an automated response could work against you. Write this one yourself, or forward it.",
    logReason: "physical harm described",
  },
  STAFF_MISCONDUCT: {
    label: "Staff misconduct",
    explanation:
      "This review accuses your staff of serious misconduct, and an automated response could work against you. Write this one yourself, or forward it.",
    logReason: "serious staff misconduct alleged",
  },
  MINOR_SAFETY: {
    label: "A child's safety",
    explanation:
      "This review raises a concern about a child's safety, and an automated response could work against you. Write this one yourself, or forward it.",
    logReason: "a child's safety raised",
  },
};

export function categoryLabel(category: string | null | undefined): string {
  if (!category) return "Escalated";
  return ESCALATION_COPY[category as EscalatableCategory]?.label ?? "Escalated";
}

export function categoryExplanation(
  category: string | null | undefined,
): string {
  const copy = ESCALATION_COPY[category as EscalatableCategory];
  return (
    copy?.explanation ??
    "This review needs a person. An automated response could work against you, so write this one yourself, or forward it."
  );
}

/**
 * Phrases that escalate on sight, with no model call.
 *
 * High precision, low recall by design — the classifier is what catches the
 * same intent expressed in language no list anticipates. These two run as a
 * union, not a filter: a keyword hit escalates immediately and skips the
 * classifier entirely, which also means it costs nothing.
 *
 * Matching is on word boundaries against normalized text, so "assuming" does
 * not trip "sue" and "Suing" trips "suing".
 *
 * Categories on a keyword hit are a best-effort label. `police` and `theft`
 * genuinely straddle categories; the label is a heading on a screen where a
 * human is already reading the quoted evidence, so a near-miss on the heading
 * costs far less than failing to escalate.
 *
 * MINOR_SAFETY has no keywords. There is no short phrase that reliably means
 * "a child was put at risk" without catching every review that mentions kids,
 * so that category is left entirely to the classifier.
 */
export const ESCALATION_KEYWORDS: Record<EscalatableCategory, string[]> = {
  LEGAL_THREAT: [
    "lawyer",
    "attorney",
    "sue",
    "suing",
    "legal action",
    "small claims",
  ],
  HEALTH_SAFETY: [
    "food poisoning",
    "hospital",
    "ambulance",
    "allergic reaction",
    "contamination",
    "rodent",
    "cockroach",
  ],
  DISCRIMINATION: ["racist", "racial", "discriminated", "refused to serve"],
  PHYSICAL_HARM: ["assaulted", "groped"],
  STAFF_MISCONDUCT: ["stole", "theft", "police"],
  MINOR_SAFETY: [],
};

/** Flat list of every trigger phrase, for the settings screen and the README. */
export const ALL_ESCALATION_KEYWORDS: string[] = Object.values(
  ESCALATION_KEYWORDS,
).flat();

/** Categories the classifier may return, excluding NONE. */
export const ESCALATABLE_CATEGORIES = Object.keys(
  ESCALATION_COPY,
) as EscalatableCategory[];

export function isEscalatable(
  category: EscalationCategory,
): category is EscalatableCategory {
  return category !== "NONE";
}
