import {
  GENERATION_RESPONSE_SCHEMA,
  generationResult,
  type GenerationResult,
} from "@/lib/ai/schemas";
import { MODELS } from "@/lib/config/ai";
import { GUARDRAILS, toneFor } from "@/lib/config/voice";
import type { PipelineContext, PipelineReview, Violation } from "./types";
import { splitSentences } from "./validate";

/**
 * Stage 3 — generation.
 *
 * The only generative call in the system, and only reviews that cleared both
 * gates reach it. Structured output, always: the schema is the contract.
 */

/**
 * The system instruction carries the voice, the business facts, and the
 * prohibition list stated as instructions.
 *
 * Giving the model its constraints up front reduces how often the validator has
 * to intervene, which saves a repair call. It is not why the replies are safe —
 * the validator is why they are safe.
 */
export function buildSystemInstruction(ctx: PipelineContext): string {
  const tone = toneFor(ctx.brandVoice.tone);

  const lines = [
    `You write short public replies to customer reviews on behalf of ${ctx.businessName}. You are writing as the business, so use "we".`,
    "",
    `Voice: ${tone.name}. ${tone.desc}`,
    "",
    "How to write:",
    "- Two to four sentences. This is a public reply under a review, not a letter.",
    "- Answer what the customer actually wrote about. Name the specific thing they mentioned.",
    "- Do not open every reply the same way, and do not use the phrase 'we're sorry to hear'.",
    "- Write plain text. This is posted verbatim under a review: no HTML, no HTML entities such as &eacute;, no Markdown. Write accented characters directly.",
    "- Never argue with the customer or dispute their account.",
    "- Never invite the customer to contact you unless you have a contact address to give them.",
  ];

  if (ctx.brandVoice.contactEmail) {
    lines.push(
      `- When a customer is unhappy, point them to ${ctx.brandVoice.contactEmail} to take it off the public profile.`,
    );
  }

  if (ctx.brandVoice.alwaysMention.trim()) {
    lines.push(
      `- Work this in where it fits naturally, without quoting it word for word: "${ctx.brandVoice.alwaysMention.trim()}"`,
    );
  }

  lines.push(
    "",
    "Rules you must not break. These are absolute:",
    ...GUARDRAILS.map((rule, i) => `${i + 1}. ${rule.instruction}`),
    "",
    `Reply in the language the review is written in. Address the reviewer by their first name only if it reads naturally.`,
  );

  return lines.join("\n");
}

function reviewPrompt(review: PipelineReview): string {
  return [
    `Rating: ${review.rating} out of 5`,
    `Reviewer: ${review.authorName}`,
    `Review: ${review.text || "(no text — a rating only)"}`,
    "",
    "Write the reply.",
  ].join("\n");
}

export async function generateReply(
  review: PipelineReview,
  ctx: PipelineContext,
): Promise<GenerationResult> {
  return ctx.ai.generateStructured<GenerationResult>({
    model: MODELS.generation,
    label: "generate",
    systemInstruction: buildSystemInstruction(ctx),
    prompt: reviewPrompt(review),
    responseSchema: GENERATION_RESPONSE_SCHEMA,
    parse: (raw) => generationResult.parse(raw),
  });
}

/**
 * The single repair attempt.
 *
 * Re-prompts with the rule that was broken and the offending sentence quoted,
 * rather than asking the model to try again in general terms. There is exactly
 * one of these: if the second attempt also violates, we stop and hand the
 * review to a person.
 */
export async function repairReply(
  review: PipelineReview,
  ctx: PipelineContext,
  previousReply: string,
  violations: Violation[],
): Promise<GenerationResult> {
  const byCode = new Map<string, Violation[]>();
  for (const violation of violations) {
    byCode.set(violation.code, [...(byCode.get(violation.code) ?? []), violation]);
  }

  const complaints = [...byCode.entries()].map(([code, group]) => {
    const rule = GUARDRAILS.find((g) => g.code === code);
    const quoted = [...new Set(group.map((v) => v.excerpt))]
      .map((excerpt) => `  "${excerpt}"`)
      .join("\n");
    return `Rule broken: ${rule?.instruction ?? code}\nIn this sentence:\n${quoted}`;
  });

  const prompt = [
    reviewPrompt(review),
    "",
    "You already wrote this reply, and it broke a rule:",
    `"""${previousReply}"""`,
    "",
    ...complaints,
    "",
    "Write the reply again. Keep everything that was fine, remove the part that broke the rule, and do not replace it with a different version of the same offer or admission. Say less rather than substituting something equally risky.",
  ].join("\n");

  return ctx.ai.generateStructured<GenerationResult>({
    model: MODELS.generation,
    label: "generate:repair",
    systemInstruction: buildSystemInstruction(ctx),
    prompt,
    responseSchema: GENERATION_RESPONSE_SCHEMA,
    parse: (raw) => generationResult.parse(raw),
  });
}

/**
 * What the repair wrote in place of the offending sentence.
 *
 * The detail screen shows "removed / written instead", so it needs both halves.
 * There is no reliable way to know which new sentence replaced which old one,
 * so this reports the sentences the repair added that were not there before —
 * which is the honest answer to "what changed", and empty when the repair
 * simply deleted the offending line.
 */
export function sentencesAddedIn(after: string, before: string): string {
  const previous = new Set(
    splitSentences(before).map((s) => s.text.toLowerCase()),
  );
  const added = splitSentences(after)
    .map((s) => s.text)
    .filter((text) => !previous.has(text.toLowerCase()));

  return added.slice(0, 2).join(" ");
}
