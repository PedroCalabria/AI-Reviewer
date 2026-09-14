import { z } from "zod";
import { ESCALATION_CATEGORIES } from "@/lib/constants";
import { toPlainReply } from "./text";

/**
 * The contract for every model call: an OpenAPI-subset schema sent to Gemini as
 * `responseSchema`, and a Zod schema that checks what actually came back.
 *
 * Two layers because they catch different things. `responseSchema` constrains
 * decoding, so the response is JSON of roughly the right shape. Zod catches the
 * rest: an empty reply, a confidence outside 0..1, a category the model made
 * up. A failure in either is handled — the classifier fails closed and
 * escalates, the generator marks the review for a manual reply — never a parse
 * error thrown at a user.
 */

// --- Escalation classifier ---------------------------------------------------

export const CLASSIFIER_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    category: {
      type: "STRING",
      enum: [...ESCALATION_CATEGORIES],
      description:
        "The single most serious category this review falls into, or NONE.",
    },
    confidence: {
      type: "NUMBER",
      description:
        "How confident you are, from 0 to 1. Use 0 when the category is NONE.",
    },
    evidence: {
      type: "STRING",
      description:
        "A short span copied VERBATIM from the review that justifies the category. Empty string when the category is NONE. Do not paraphrase; copy the exact characters.",
    },
  },
  required: ["category", "confidence", "evidence"],
  propertyOrdering: ["category", "confidence", "evidence"],
} as const;

export const classifierResult = z.object({
  category: z.enum(ESCALATION_CATEGORIES),
  confidence: z.number().min(0).max(1),
  evidence: z.string(),
});

export type ClassifierResult = z.infer<typeof classifierResult>;

// --- Reply generation --------------------------------------------------------

export const GENERATION_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    reply: {
      type: "STRING",
      description:
        "The public reply to post under the review. This is the only field a customer will read.",
    },
    themes: {
      type: "ARRAY",
      items: { type: "STRING" },
      description:
        "Two to four short lowercase noun phrases naming what the review is about, e.g. 'wait time', 'staff attentiveness'. Empty if the review says nothing specific.",
    },
    toneUsed: {
      type: "STRING",
      description: "The brand voice you wrote in.",
    },
    language: {
      type: "STRING",
      description:
        "The BCP-47 tag of the language you wrote the reply in, e.g. 'en', 'es', 'fr'. This must be the language of the REPLY, not of these instructions.",
    },
    reasoning: {
      type: "STRING",
      description:
        "One sentence explaining your approach, for an internal activity log. Never shown to a customer.",
    },
  },
  required: ["reply", "themes", "toneUsed", "language", "reasoning"],
  propertyOrdering: ["reply", "themes", "toneUsed", "language", "reasoning"],
} as const;

export const generationResult = z.object({
  // Normalized to plain text before anything else sees it, including the
  // validator: a reply is posted verbatim to a public profile, so an HTML
  // entity in it is a defect a customer would read.
  reply: z
    .string()
    .transform(toPlainReply)
    .pipe(z.string().min(1, "The model returned an empty reply.")),
  // A model that decides on twelve themes is not helping the tag row.
  themes: z.array(z.string().trim().min(1)).max(6).default([]),
  toneUsed: z.string().default(""),
  // Drives whether the named-individual check can run: its "capitalized
  // mid-sentence means proper noun" premise only holds for English.
  language: z.string().default("en"),
  reasoning: z.string().default(""),
});

export type GenerationResult = z.infer<typeof generationResult>;
