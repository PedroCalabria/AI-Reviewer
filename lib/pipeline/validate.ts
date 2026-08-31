import { guardrailFor } from "@/lib/config/voice";
import type { GuardrailCode } from "@/lib/constants";
import type { Violation } from "./types";

/**
 * Stage 4 — the output validator.
 *
 * Deterministic, regex-based, and run on every generated reply before a human
 * ever sees it. The system instruction already tells the model these rules, but
 * that is a hint; this is the enforcement. Nothing here calls a model, so it
 * cannot fail in the way a model can.
 *
 * The bias throughout is toward catching too much. A false catch costs one
 * repair call. A miss puts a promise of a refund on a public profile under the
 * owner's name.
 */

export type ValidatorContext = {
  businessName: string;
  /** The reviewer may be addressed by the name they posted under. */
  reviewerName: string;
  /** Extra proper nouns that are legitimate here — a city, a neighbourhood. */
  allowedNames?: string[];
  /**
   * BCP-47 tag of the language the reply is written in, as reported by the
   * model. Decides whether the named-individual heuristic can run at all.
   */
  language?: string;
};

// --- Sentence handling -------------------------------------------------------

type Sentence = { text: string; start: number; end: number };

/**
 * Sentences with their offsets, so a match can be reported in context.
 *
 * A period only ends a sentence when whitespace or the end of the text follows
 * it. Without that condition "hello@cornertable.com" splits into two, and the
 * excerpt quoted back to the model on a repair — and shown to the operator in
 * the diff — comes out mangled.
 */
export function splitSentences(text: string): Sentence[] {
  const out: Sentence[] = [];
  const terminator = /[.!?]+(?=\s|$)|\n+/g;
  let start = 0;
  let match: RegExpExecArray | null;

  const push = (from: number, to: number) => {
    const raw = text.slice(from, to);
    if (raw.trim()) out.push({ text: raw.trim(), start: from, end: to });
  };

  while ((match = terminator.exec(text)) !== null) {
    const end = match.index + match[0].length;
    push(start, end);
    start = end;
  }
  push(start, text.length);

  return out.length ? out : [{ text: text.trim(), start: 0, end: text.length }];
}

function sentenceAt(sentences: Sentence[], index: number): string {
  const found = sentences.find((s) => index >= s.start && index < s.end);
  return found?.text ?? "";
}

// --- Rules -------------------------------------------------------------------

type Rule = { code: GuardrailCode; patterns: RegExp[] };

const RULES: Rule[] = [
  {
    code: "NO_COMPENSATION",
    patterns: [
      /\brefunds?(?:ed|ing)?\b/i,
      /\breimburse(?:d|ment|ments)?\b/i,
      /\bdiscounts?(?:ed)?\b/i,
      /\bvouchers?\b/i,
      /\bcomp(?:ed|ing)?\b/i,
      /\bfree (?:meal|drink|dessert|item|coffee|round|starter|appetizer|appetiser|entree|entrée|course|visit|night|stay)s?\b/i,
      /\bcompensat(?:e|ed|ing|ion)\b/i,
      /\bcredits?\b(?! card)/i,
      /\bgift card\b/i,
      /\bon us\b/i,
      /\bon the house\b/i,
      /\bno charge\b/i,
      /\bwaive(?:d|r)?\b/i,
      /\bmoney back\b/i,
    ],
  },
  {
    code: "NO_FAULT",
    patterns: [
      /\bour fault\b/i,
      /\bmy fault\b/i,
      /\bwe (?:were|are|have been) negligent\b/i,
      /\bnegligence\b/i,
      /\bwe failed (?:to|you)\b/i,
      /\bwe let you down\b/i,
      /\bthis was a violation\b/i,
      /\bwe (?:broke|breached|violated)\b/i,
      /\bwe (?:are|were|would be) liable\b/i,
      /\bliability\b/i,
      /\bwe admit\b/i,
      /\bwe accept (?:full )?(?:responsibility|blame)\b/i,
      /\bwe (?:take|took) (?:full )?(?:responsibility|blame)\b/i,
      /\bwe (?:are|were) (?:in the )?wrong\b/i,
      /\byou(?:'re| are) right,? we\b/i,
    ],
  },
  {
    code: "NO_GUARANTEE",
    patterns: [
      /\b(?:will|won't|would) never happen again\b/i,
      /\bnever happen(?:s)? again\b/i,
      /\bwe guarantee\b/i,
      /\bi guarantee\b/i,
      /\bwe can (?:assure|promise) you\b/i,
      /\bi promise(?: you)?\b/i,
      /\bwe promise\b/i,
      /\byou have (?:my|our) word\b/i,
      /\brest assured\b/i,
      /\bthis will not (?:happen|occur) again\b/i,
    ],
  },
];

/**
 * Refusals that are explicitly NOT commitments.
 *
 * "We are unable to offer a refund" is the opposite of promising one, and the
 * validator should not send the model round again for saying so. Kept
 * deliberately tight: the refusal has to govern the money word directly, with
 * at most an offering verb between them. That is what stops "we can't wait to
 * give you a free dessert" from slipping through on the strength of its
 * "can't".
 */
const REFUSAL_PATTERN =
  /\b(?:cannot|can not|can't|could not|couldn't|unable to|won't|will not|do not|don't|does not|doesn't|not able to|no)\s+(?:be able to\s+)?(?:offer|provide|give|issue|process|honou?r|arrange|extend|make)?\s*(?:any |a |an |the )?(?:refunds?|reimbursements?|discounts?|vouchers?|compensation|credits?|money back)\b/i;

function isRefusal(sentence: string): boolean {
  return REFUSAL_PATTERN.test(sentence);
}

// --- Named individuals -------------------------------------------------------

/**
 * Capitalized words that are not somebody's first name.
 *
 * The rule is "any capitalized first name that is not the business name or the
 * reviewer's name", and there is no way to decide that from a regex alone. The
 * approximation is: a capitalized word in the middle of a sentence, minus this
 * list. It over-triggers on unusual proper nouns, and over-triggering costs one
 * repair — the cheap direction. Callers can widen it with `allowedNames`.
 */
const NOT_A_NAME = new Set(
  [
    // Sentence connectives and pronouns that turn up mid-sentence after a dash
    // or a quote.
    "I", "We", "Our", "Ours", "Us", "You", "Your", "Yours", "It", "Its",
    "The", "A", "An", "And", "But", "So", "If", "When", "While", "That",
    "This", "There", "Here", "However", "Also", "Again", "Unfortunately",
    "Fortunately", "Yes", "No", "Ok", "Okay", "Please", "Thanks", "Thank",
    "Sorry", "Hi", "Hello", "Hey", "Dear", "Best", "Regards", "Sincerely",
    "Cheers", "Kind", "Warm", "All", "Every", "Both", "Either", "Neither",
    // Days and months.
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
    "Sunday", "January", "February", "March", "April", "May", "June", "July",
    "August", "September", "October", "November", "December",
    // Platforms and things a reply legitimately names.
    "Google", "Business", "Profile", "Maps", "Yelp", "Internet", "WiFi",
    "Wi", "Fi", "Covid", "COVID",
    // Address parts.
    "Street", "Avenue", "Road", "Drive", "Lane", "Boulevard", "Suite",
    "Floor", "Unit", "North", "South", "East", "West", "New", "Old", "Saint",
    "St", "Ave", "Rd", "Blvd",
    // Meal and service nouns that get capitalized in headings and lists.
    "Happy", "Hour", "Sunday", "Brunch", "Lunch", "Dinner", "Breakfast",
    "Menu", "Team", "Manager", "Chef", "Kitchen", "Front", "House",
    // Holidays.
    "Christmas", "Easter", "Thanksgiving", "Halloween", "Year", "Eve",
  ].map((word) => word.toLowerCase()),
);

function nameTokens(value: string): string[] {
  return value
    .split(/[^\p{L}]+/u)
    .filter((token) => token.length > 1)
    .map((token) => token.toLowerCase());
}

/**
 * True when the character before `index` ends a sentence or starts the text.
 *
 * Everything that can legitimately open a sentence is skipped over on the way
 * back, which includes the opening marks Spanish puts in front of the first
 * word. Miss those and "¡Muchas gracias!" reads as a proper noun called
 * "Muchas".
 */
const SENTENCE_OPENERS = /["'“‘(\[{«‹¡¿\-–—*•]/;

function isSentenceInitial(text: string, index: number): boolean {
  for (let i = index - 1; i >= 0; i--) {
    const char = text[i];
    if (/\s/.test(char)) continue;
    if (SENTENCE_OPENERS.test(char)) continue;
    return /[.!?:\n]/.test(char);
  }
  return true;
}

/**
 * Does "a capitalized word mid-sentence is a proper noun" hold for this reply?
 *
 * It is an English-language premise. German capitalizes every noun, so the
 * heuristic would flag most words in a perfectly good German reply, fail the
 * repair for the same reason, and hand the operator a manual-reply that never
 * needed to be one. Spanish and French are milder but still produce false
 * positives on titles and openings.
 *
 * So the rule is applied to English replies only, and the model tells us which
 * language it wrote in. The prohibition itself still reaches every reply — it is
 * in the system instruction for all of them — but it is only *enforced* by regex
 * where regex can do the job honestly. This is a real gap and it is named in the
 * README rather than papered over.
 */
const NON_ENGLISH = new Map<string, string>(
  Object.entries({
    es: "spanish",
    fr: "french",
    de: "german",
    pt: "portuguese",
    it: "italian",
    nl: "dutch",
    sv: "swedish",
    da: "danish",
    nb: "norwegian",
    no: "norwegian",
    fi: "finnish",
    pl: "polish",
    cs: "czech",
    tr: "turkish",
    ru: "russian",
    uk: "ukrainian",
    el: "greek",
    ar: "arabic",
    he: "hebrew",
    hi: "hindi",
    th: "thai",
    vi: "vietnamese",
    id: "indonesian",
    zh: "chinese",
    ja: "japanese",
    ko: "korean",
  }),
);

function capitalizationSignalsProperNoun(language: string | undefined): boolean {
  if (!language) return true;

  const value = language.trim().toLowerCase();
  if (!value) return true;

  // Positively identify a non-English language before switching the rule off.
  // Deciding it the other way round — "run it only when I recognise English" —
  // would silently disable the check whenever a model answered "American
  // English" or something else unanticipated, and that is the unsafe direction.
  const tag = value.split(/[-_]/)[0];
  for (const [code, name] of NON_ENGLISH) {
    if (tag === code || value.startsWith(name)) return false;
  }

  return true;
}

export function findNamedIndividuals(
  reply: string,
  ctx: ValidatorContext,
): Violation[] {
  if (!capitalizationSignalsProperNoun(ctx.language)) return [];

  const allowed = new Set<string>([
    ...nameTokens(ctx.businessName),
    ...nameTokens(ctx.reviewerName),
    ...(ctx.allowedNames ?? []).flatMap(nameTokens),
  ]);

  const sentences = splitSentences(reply);
  const violations: Violation[] = [];
  const seen = new Set<string>();

  const token = /\b\p{Lu}\p{Ll}+\b/gu;
  let match: RegExpExecArray | null;

  while ((match = token.exec(reply)) !== null) {
    const word = match[0];
    const lower = word.toLowerCase();

    if (allowed.has(lower)) continue;
    if (NOT_A_NAME.has(lower)) continue;
    if (isSentenceInitial(reply, match.index)) continue;
    if (seen.has(lower)) continue;

    seen.add(lower);
    violations.push({
      code: "NO_NAMES",
      pattern: word,
      excerpt: sentenceAt(sentences, match.index),
    });
  }

  return violations;
}

// --- The validator -----------------------------------------------------------

/**
 * Every violation in a reply. Empty means the reply is safe to show a human.
 *
 * All four rules run — we do not stop at the first catch — because the repair
 * prompt is more likely to succeed when it names every problem at once.
 */
export function validateReply(
  reply: string,
  ctx: ValidatorContext,
): Violation[] {
  const sentences = splitSentences(reply);
  const violations: Violation[] = [];

  for (const rule of RULES) {
    for (const pattern of rule.patterns) {
      const scoped = new RegExp(pattern.source, `${pattern.flags.replace("g", "")}g`);
      let match: RegExpExecArray | null;

      while ((match = scoped.exec(reply)) !== null) {
        const excerpt = sentenceAt(sentences, match.index);

        if (rule.code === "NO_COMPENSATION" && isRefusal(excerpt)) continue;

        // One violation per rule per sentence; a sentence offering both a
        // refund and a discount is one thing to fix.
        const duplicate = violations.some(
          (v) => v.code === rule.code && v.excerpt === excerpt,
        );
        if (!duplicate) {
          violations.push({ code: rule.code, pattern: match[0], excerpt });
        }

        if (scoped.lastIndex === match.index) scoped.lastIndex++;
      }
    }
  }

  violations.push(...findNamedIndividuals(reply, ctx));

  return violations;
}

/** The operator-facing note for a set of violations of one rule. */
export function repairNoteFor(code: GuardrailCode): string {
  return guardrailFor(code).repairNote;
}
