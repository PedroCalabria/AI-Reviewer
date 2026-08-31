import type { AiClient } from "@/lib/ai/types";
import type { ClassifierResult, GenerationResult } from "@/lib/ai/schemas";
import type {
  EscalatableCategory,
  EscalationTrigger,
  GuardrailCode,
  ToneName,
} from "@/lib/constants";

/** The minimum a review needs to be to go through the pipeline. */
export type PipelineReview = {
  /** Stable identifier. Drives deterministic template rotation. */
  id: string;
  rating: number;
  text: string;
  authorName: string;
};

export type BrandVoiceSettings = {
  tone: ToneName;
  /** Free text to work into every reply. May be empty. */
  alwaysMention: string;
  /** Where to point unhappy customers. May be empty. */
  contactEmail: string;
};

export type PipelineContext = {
  ai: AiClient;
  businessName: string;
  brandVoice: BrandVoiceSettings;
  /**
   * A classifier result we already have for this review. Classification is
   * cached forever — the answer cannot change — so a re-sync passes the stored
   * result here and spends nothing.
   */
  cachedClassification?: ClassifierResult | null;
};

/**
 * The triage decision, exactly as the brief defines it. Three routes, and only
 * one of them reaches a generative model call.
 */
export type TriageRoute =
  | {
      route: "ESCALATE";
      /**
       * Null when the classifier itself failed. We escalate anyway — failing
       * closed — but we will not invent a category we did not determine.
       */
      category: EscalatableCategory | null;
      trigger: EscalationTrigger;
      /** A verbatim span from the review. Empty when the classifier failed. */
      evidence: string;
      /** Set when the escalation came from a classifier call that succeeded. */
      classification?: ClassifierResult;
      /** Why we failed closed, for the activity log. */
      failureReason?: string;
    }
  | {
      route: "TEMPLATE";
      /** `${tone}:${variant}` — identifies the exact canned reply used. */
      templateId: string;
      variant: number;
      text: string;
    }
  | { route: "GENERATE" };

/** One validator catch. */
export type Violation = {
  code: GuardrailCode;
  /** The literal text that matched, for the log. */
  pattern: string;
  /** The whole offending sentence, quoted back to the model on the repair. */
  excerpt: string;
};

/** One trip through the generator, whether or not it survived the validator. */
export type GenerationAttempt = {
  attempt: number;
  result: GenerationResult;
  violations: Violation[];
};

/** What a repair changed, in the shape the detail screen renders. */
export type Repair = {
  code: GuardrailCode;
  pattern: string;
  /** "Adjusted: an offer of compensation was removed." */
  note: string;
  /** The sentence the first attempt produced. */
  removed: string;
  /** What the second attempt wrote in its place. May be empty. */
  replaced: string;
};

export type PipelineOutcome =
  | {
      route: "ESCALATE";
      category: EscalatableCategory | null;
      trigger: EscalationTrigger;
      evidence: string;
      classification?: ClassifierResult;
      failureReason?: string;
    }
  | {
      route: "TEMPLATE";
      templateId: string;
      variant: number;
      text: string;
    }
  | {
      route: "GENERATE";
      /** The generator ran and the validator passed it. */
      outcome: "drafted";
      reply: string;
      themes: string[];
      toneUsed: string;
      reasoning: string;
      attempts: GenerationAttempt[];
      /** Empty when the first attempt was clean. */
      repairs: Repair[];
      classification?: ClassifierResult;
    }
  | {
      route: "GENERATE";
      /** Two attempts, both blocked. A person has to write this one. */
      outcome: "needs_manual_reply";
      attempts: GenerationAttempt[];
      /** The violations that survived the repair. */
      violations: Violation[];
      classification?: ClassifierResult;
    }
  | {
      route: "GENERATE";
      /** No key configured, or today's budget is spent. Not a failure. */
      outcome: "paused";
      reason: string;
      classification?: ClassifierResult;
    }
  | {
      route: "GENERATE";
      /** The call itself failed. The next sync can try again. */
      outcome: "failed";
      reason: string;
      classification?: ClassifierResult;
    };
