import type { ClassifierResult, GenerationResult } from "@/lib/ai/schemas";
import type { AiClient, StructuredRequest } from "@/lib/ai/types";
import type { PipelineContext, PipelineReview } from "../types";

/**
 * Test doubles for the pipeline.
 *
 * Nothing in this directory touches the network. The LLM is replaced with
 * scripted responses so every guardrail assertion is deterministic and runs in
 * milliseconds — which is the point: a safety net you cannot run on every
 * commit is not a safety net.
 */

export type AiScript = {
  /** What the classifier returns, or an error it throws. */
  classify?: ClassifierResult | Error;
  /**
   * Generation responses, consumed in order: index 0 is the first attempt,
   * index 1 the repair. An Error at a position throws instead.
   */
  generate?: Array<GenerationResult | Error>;
};

export type MockAi = AiClient & {
  /** Every call the pipeline made, in order. */
  calls: Array<{ label: string; model: string; prompt: string }>;
  /** Calls whose label starts with "generate". */
  generateCalls: () => number;
  classifyCalls: () => number;
};

export function mockAi(script: AiScript = {}): MockAi {
  const calls: MockAi["calls"] = [];
  let generateIndex = 0;

  const client: MockAi = {
    calls,
    generateCalls: () =>
      calls.filter((call) => call.label.startsWith("generate")).length,
    classifyCalls: () =>
      calls.filter((call) => call.label === "classifier").length,

    async hasBudget() {
      return true;
    },

    async generateStructured<T>(request: StructuredRequest<T>): Promise<T> {
      calls.push({
        label: request.label,
        model: request.model,
        prompt: request.prompt,
      });

      if (request.label === "classifier") {
        const scripted = script.classify;
        if (!scripted) {
          throw new Error(
            "The test called the classifier without scripting a response.",
          );
        }
        if (scripted instanceof Error) throw scripted;
        return request.parse(scripted);
      }

      const scripted = script.generate?.[generateIndex++];
      if (!scripted) {
        throw new Error(
          `The test called the generator ${generateIndex} time(s) without scripting that many responses.`,
        );
      }
      if (scripted instanceof Error) throw scripted;
      return request.parse(scripted);
    },
  };

  return client;
}

export function classification(
  category: ClassifierResult["category"],
  confidence = 0.9,
  evidence = "",
): ClassifierResult {
  return { category, confidence, evidence };
}

export function generated(
  reply: string,
  overrides: Partial<GenerationResult> = {},
): GenerationResult {
  return {
    reply,
    themes: ["service"],
    toneUsed: "Warm",
    language: "en",
    reasoning: "Acknowledged the specific complaint without conceding anything.",
    ...overrides,
  };
}

export const BUSINESS_NAME = "Corner Table Bistro";

export function review(
  overrides: Partial<PipelineReview> = {},
): PipelineReview {
  return {
    id: "review-1",
    rating: 3,
    text: "The food was fine but we waited a long time to be seated.",
    authorName: "Dana K.",
    ...overrides,
  };
}

export function context(
  ai: AiClient,
  overrides: Partial<PipelineContext> = {},
): PipelineContext {
  return {
    ai,
    businessName: BUSINESS_NAME,
    brandVoice: {
      tone: "Warm",
      alwaysMention: "",
      contactEmail: "hello@cornertable.com",
    },
    ...overrides,
  };
}
