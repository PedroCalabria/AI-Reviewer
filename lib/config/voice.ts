import type { GuardrailCode, ToneName } from "@/lib/constants";

/**
 * Brand voice and the prohibition list.
 *
 * The tone descriptions here go into the model's system instruction verbatim,
 * and the same objects back the tone cards in onboarding and settings — so what
 * the owner picks and what the model is told are the same text, not two
 * descriptions that can drift apart.
 */

export type Tone = {
  name: ToneName;
  /** Shown on the tone card, and given to the model as the voice to write in. */
  desc: string;
  /**
   * A worked example, shown as the live preview. Static on purpose: generating
   * a preview on every settings visit would spend free-tier budget to show
   * something the owner is only glancing at.
   */
  example: string;
};

export const TONES: Tone[] = [
  {
    name: "Warm",
    desc: "Friendly and personal. Uses contractions, thanks people by feeling.",
    example:
      "Thank you so much for the kind words about brunch, Dana! We're glad it hit the spot, and we'll keep a closer eye on how hot the coffee goes out. Hope to see you again soon.",
  },
  {
    name: "Professional",
    desc: "Measured and businesslike. Complete sentences, no slang.",
    example:
      "Thank you for your feedback. We are pleased you enjoyed brunch, and we have noted your comment about coffee temperature for our team to review.",
  },
  {
    name: "Concise",
    desc: "Two sentences maximum. Acknowledges and moves on.",
    example:
      "Thanks for the feedback, Dana. We'll look at our coffee temperature.",
  },
  {
    name: "Playful",
    desc: "Light and informal. Fits casual brands.",
    example:
      "Brunch win, coffee not quite hot enough — noted. We'll turn up the heat for next time. Thanks for stopping by, Dana!",
  },
];

export function toneFor(name: string): Tone {
  return TONES.find((t) => t.name === name) ?? TONES[0];
}

export type Guardrail = {
  code: GuardrailCode;
  /** The rule as the owner reads it on the settings screen. */
  text: string;
  /** A reply we would block, shown beside the rule. */
  example: string;
  /**
   * The rule as the model is told it, in the system instruction. Stating the
   * constraints up front reduces how often the validator has to intervene — but
   * the validator is the enforcement and this is only the hint.
   */
  instruction: string;
  /** The note shown under a draft after this rule caused a repair. */
  repairNote: string;
};

export const GUARDRAILS: Guardrail[] = [
  {
    code: "NO_COMPENSATION",
    text: "We never offer a refund, a discount, or a free item.",
    example: "Come back this week and your next meal is on us.",
    instruction:
      "Never offer or imply a refund, discount, voucher, credit, free item, or any other compensation. Do not say anything is 'on us', 'on the house', or 'no charge'. If the customer deserves to be made whole, point them at the follow-up contact instead.",
    repairNote: "Adjusted: an offer of compensation was removed.",
  },
  {
    code: "NO_FAULT",
    text: "We never admit that your business was at fault.",
    example: "You're right, we completely failed you that night.",
    instruction:
      "Never admit fault, negligence, liability, or wrongdoing. Do not say we failed, we were negligent, this was our fault, we broke a rule, or that we are liable. Acknowledge how the experience felt without accepting blame for it.",
    repairNote: "Adjusted: an admission of fault was removed.",
  },
  {
    code: "NO_GUARANTEE",
    text: "We never promise that a problem won't happen again.",
    example: "This will never happen again.",
    instruction:
      "Never guarantee a future outcome. Do not promise something will never happen again, do not say 'we guarantee', 'I promise', or 'you have my word'. Say what you are looking at, not what you are certain of.",
    repairNote: "Adjusted: a promise we can't keep was removed.",
  },
  {
    code: "NO_NAMES",
    text: "We never name an employee or another business.",
    example: "I've spoken with Maria about how she treated you.",
    instruction:
      "Never name an individual. Do not name employees, managers, or other businesses. Refer to 'our team' or 'the manager on duty'. You may address the reviewer by the name they posted under.",
    repairNote: "Adjusted: an employee's name was removed.",
  },
];

export function guardrailFor(code: GuardrailCode): Guardrail {
  const found = GUARDRAILS.find((g) => g.code === code);
  if (!found) throw new Error(`Unknown guardrail code: ${code}`);
  return found;
}
