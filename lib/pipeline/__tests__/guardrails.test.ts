import { describe, expect, it } from "vitest";
import { generationResult } from "@/lib/ai/schemas";
import { toPlainReply } from "@/lib/ai/text";
import { AiBudgetExhaustedError, AiUnavailableError } from "@/lib/ai/types";
import {
  ALL_ESCALATION_KEYWORDS,
  ESCALATION_KEYWORDS,
} from "@/lib/config/escalation";
import { templateVariantFor } from "@/lib/config/templates";
import type { EscalatableCategory } from "@/lib/constants";
import {
  matchKeywords,
  runPipeline,
  splitSentences,
  validateReply,
  type PipelineOutcome,
} from "../index";
import {
  BUSINESS_NAME,
  classification,
  context,
  generated,
  mockAi,
  review,
} from "./fixtures";

/**
 * The guardrail suite.
 *
 * Every case runs against fixed fixtures with a scripted model. No network, no
 * API key, no flake — so this can gate every commit.
 *
 * The assertions that matter most are the negative ones: that an escalated
 * review never reaches the generator, and that a reply which breaks a rule
 * twice is never shown to the operator as a draft.
 */

const validator = { businessName: BUSINESS_NAME, reviewerName: "Dana K." };

function expectRoute<R extends PipelineOutcome["route"]>(
  outcome: PipelineOutcome,
  route: R,
): Extract<PipelineOutcome, { route: R }> {
  expect(outcome.route).toBe(route);
  return outcome as Extract<PipelineOutcome, { route: R }>;
}

// ---------------------------------------------------------------------------
// Stage 1 — keyword triggers
// ---------------------------------------------------------------------------

describe("escalation gate — keyword triggers", () => {
  it.each(ALL_ESCALATION_KEYWORDS)(
    "escalates on %s with no model call",
    async (keyword) => {
      const ai = mockAi();
      const outcome = await runPipeline(
        review({ text: `I want to talk about the ${keyword} situation here.` }),
        context(ai),
      );

      const escalated = expectRoute(outcome, "ESCALATE");
      expect(escalated.trigger).toBe("keyword");
      expect(escalated.evidence.toLowerCase()).toBe(keyword);
      // The keyword gate is deterministic and free. Nothing should have been
      // sent anywhere.
      expect(ai.calls).toHaveLength(0);
    },
  );

  it("maps each keyword to the category it was declared under", () => {
    for (const [category, phrases] of Object.entries(ESCALATION_KEYWORDS)) {
      for (const phrase of phrases) {
        const hit = matchKeywords(`Something about ${phrase} happened.`);
        expect(hit?.category).toBe(category as EscalatableCategory);
      }
    }
  });

  it("matches on word boundaries, so 'assuming' does not trip 'sue'", () => {
    expect(matchKeywords("I am assuming this was a one-off.")).toBeNull();
    expect(matchKeywords("Issues with the pasta.")).toBeNull();
    expect(matchKeywords("The dish was well seasoned.")).toBeNull();
  });

  it("quotes the evidence as the customer capitalized it", () => {
    const hit = matchKeywords("We are speaking to a Lawyer about this.");
    expect(hit?.evidence).toBe("Lawyer");
  });
});

// ---------------------------------------------------------------------------
// Stage 1 — the classifier
// ---------------------------------------------------------------------------

describe("escalation gate — classifier", () => {
  const freeLanguage: Array<[EscalatableCategory, string, string]> = [
    [
      "MINOR_SAFETY",
      "My four-year-old wandered straight through to the fryers and nobody stopped him.",
      "wandered straight through to the fryers",
    ],
    [
      "STAFF_MISCONDUCT",
      "The man on the till could barely stand up straight and got my change wrong twice.",
      "could barely stand up straight",
    ],
    [
      "PHYSICAL_HARM",
      "One of the servers shoved my husband out of the way and he went into the doorframe.",
      "shoved my husband out of the way",
    ],
    [
      "DISCRIMINATION",
      "They seated every other couple ahead of us and I think we both know why.",
      "seated every other couple ahead of us",
    ],
    [
      "HEALTH_SAFETY",
      "There was something moving in the bottom of the salad bowl.",
      "something moving in the bottom of the salad bowl",
    ],
    [
      "LEGAL_THREAT",
      "I have kept the receipt and I am taking this a great deal further.",
      "taking this a great deal further",
    ],
  ];

  it.each(freeLanguage)(
    "routes %s expressed in free language with no trigger keyword",
    async (category, text, evidence) => {
      // Precondition: none of these would be caught by the keyword list, so
      // the classifier genuinely has to earn the escalation.
      expect(matchKeywords(text)).toBeNull();

      const ai = mockAi({ classify: classification(category, 0.88, evidence) });
      const outcome = await runPipeline(
        review({ text, rating: 1 }),
        context(ai),
      );

      const escalated = expectRoute(outcome, "ESCALATE");
      expect(escalated.category).toBe(category);
      expect(escalated.trigger).toBe("classifier");
      expect(escalated.evidence).toBe(evidence);
      expect(ai.generateCalls()).toBe(0);
    },
  );

  it("does not escalate an ordinary complaint", async () => {
    const ai = mockAi({
      classify: classification("NONE", 0, ""),
      generate: [generated("Thanks for letting us know about the wait.")],
    });

    const outcome = await runPipeline(review({ rating: 2 }), context(ai));

    expectRoute(outcome, "GENERATE");
    expect(ai.classifyCalls()).toBe(1);
  });

  it("does not escalate below the confidence threshold", async () => {
    const ai = mockAi({
      classify: classification("STAFF_MISCONDUCT", 0.15, "rude"),
      generate: [generated("Thanks for the feedback about our team.")],
    });

    const outcome = await runPipeline(review({ rating: 2 }), context(ai));

    expectRoute(outcome, "GENERATE");
  });

  it("drops evidence the model paraphrased rather than quoted", async () => {
    const text = "They seated every other couple ahead of us.";
    const ai = mockAi({
      classify: classification(
        "DISCRIMINATION",
        0.9,
        "the reviewer felt they were passed over",
      ),
    });

    const outcome = await runPipeline(
      review({ text, rating: 1 }),
      context(ai),
    );

    const escalated = expectRoute(outcome, "ESCALATE");
    // Still escalated — but we will not put words in the customer's mouth on a
    // screen that presents them as a quotation.
    expect(escalated.evidence).toBe("");
  });

  it("recovers a verbatim span the model re-cased", async () => {
    const text = "There was something moving in the salad.";
    const ai = mockAi({
      classify: classification("HEALTH_SAFETY", 0.9, "Something Moving"),
    });

    const outcome = await runPipeline(review({ text, rating: 1 }), context(ai));

    expect(expectRoute(outcome, "ESCALATE").evidence).toBe("something moving");
  });

  it("reuses a cached classification instead of paying for it again", async () => {
    const ai = mockAi({
      generate: [generated("Thanks for taking the time to write this.")],
    });

    const outcome = await runPipeline(
      review({ rating: 2 }),
      context(ai, { cachedClassification: classification("NONE", 0, "") }),
    );

    expectRoute(outcome, "GENERATE");
    expect(ai.classifyCalls()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Fail closed
// ---------------------------------------------------------------------------

describe("escalation gate — failing closed", () => {
  it("escalates when the classifier throws", async () => {
    const ai = mockAi({ classify: new Error("503 UNAVAILABLE") });

    const outcome = await runPipeline(review({ rating: 1 }), context(ai));

    const escalated = expectRoute(outcome, "ESCALATE");
    expect(escalated.trigger).toBe("classifier");
    // We escalate, but we refuse to invent a category we did not determine.
    expect(escalated.category).toBeNull();
    expect(escalated.failureReason).toContain("503");
    expect(ai.generateCalls()).toBe(0);
  });

  it("escalates when the classifier times out", async () => {
    const ai = mockAi({
      classify: new Error("The classifier call did not answer within 30s."),
    });

    const outcome = await runPipeline(review({ rating: 5, text: "Lovely evening, though the music was far too loud for us." }), context(ai));

    expectRoute(outcome, "ESCALATE");
    expect(ai.generateCalls()).toBe(0);
  });

  it("escalates rather than drafting when the model returns unusable JSON", async () => {
    const ai = mockAi({ classify: new Error("returned text that is not valid JSON") });

    const outcome = await runPipeline(review({ rating: 2 }), context(ai));

    expectRoute(outcome, "ESCALATE");
  });

  // A classifier that cannot run is not the same as a classifier that ran and
  // failed, and conflating them would mark every review in the queue an
  // escalation the moment the key went missing.
  it("does not escalate when there is no API key at all", async () => {
    const ai = mockAi({ classify: new AiUnavailableError() });

    const outcome = await runPipeline(review({ rating: 2 }), context(ai));
    const result = expectRoute(outcome, "GENERATE");

    expect(result.outcome).toBe("paused");
    expect(ai.generateCalls()).toBe(0);
  });

  it("does not escalate when the day's budget is spent", async () => {
    const ai = mockAi({
      classify: new AiBudgetExhaustedError("gemini-2.5-flash-lite"),
    });

    const outcome = await runPipeline(review({ rating: 1 }), context(ai));
    const result = expectRoute(outcome, "GENERATE");

    expect(result.outcome).toBe("paused");
  });

  it("keeps template routing working while the model is unreachable", async () => {
    const ai = mockAi({ classify: new AiUnavailableError() });

    const outcome = await runPipeline(
      review({ rating: 5, text: "Perfect" }),
      context(ai),
    );

    // Costs nothing, needs nothing screened, and is most of a busy queue.
    expectRoute(outcome, "TEMPLATE");
  });

  it("still escalates on a keyword while the model is unreachable", async () => {
    const ai = mockAi({ classify: new AiUnavailableError() });

    const outcome = await runPipeline(
      review({ text: "We are speaking to a lawyer.", rating: 1 }),
      context(ai),
    );

    expectRoute(outcome, "ESCALATE");
    expect(ai.calls).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Stage 2 — the template gate
// ---------------------------------------------------------------------------

describe("template gate", () => {
  it("routes a four-star review with no text to a template", async () => {
    const ai = mockAi();
    const outcome = await runPipeline(
      review({ rating: 4, text: "" }),
      context(ai),
    );

    const templated = expectRoute(outcome, "TEMPLATE");
    expect(templated.text).not.toBe("");
    // Nothing was classified: there is no text to classify.
    expect(ai.calls).toHaveLength(0);
  });

  it("routes a five-star review of 39 characters to a template", async () => {
    const text = "a".repeat(39);
    expect(text).toHaveLength(39);

    const ai = mockAi({ classify: classification("NONE", 0, "") });
    const outcome = await runPipeline(
      review({ rating: 5, text }),
      context(ai),
    );

    expectRoute(outcome, "TEMPLATE");
    expect(ai.generateCalls()).toBe(0);
  });

  it("sends a five-star review of 41 characters to the generator", async () => {
    const text = "b".repeat(41);
    const ai = mockAi({
      classify: classification("NONE", 0, ""),
      generate: [generated("Thanks so much for this.")],
    });

    const outcome = await runPipeline(
      review({ rating: 5, text }),
      context(ai),
    );

    expectRoute(outcome, "GENERATE");
  });

  it("sends a three-star review with no text to the generator", async () => {
    const ai = mockAi({
      generate: [generated("Thanks for the rating — we'd love to know more.")],
    });

    const outcome = await runPipeline(
      review({ rating: 3, text: "" }),
      context(ai),
    );

    expectRoute(outcome, "GENERATE");
    // Empty text means there is nothing for the classifier to read.
    expect(ai.classifyCalls()).toBe(0);
  });

  it("rotates variants by review ID, stably", () => {
    expect(templateVariantFor("review-1")).toBe(templateVariantFor("review-1"));

    const spread = new Set(
      Array.from({ length: 40 }, (_, i) => templateVariantFor(`review-${i}`)),
    );
    // Not four identical replies in a row: the hash actually spreads.
    expect(spread.size).toBeGreaterThan(4);
  });

  it("escalates before it templates, even on a five-star review", async () => {
    const ai = mockAi();
    const outcome = await runPipeline(
      review({ rating: 5, text: "Great, but I got food poisoning." }),
      context(ai),
    );

    expectRoute(outcome, "ESCALATE");
  });
});

// ---------------------------------------------------------------------------
// Stage 4 — the validator
// ---------------------------------------------------------------------------

describe("output validator", () => {
  it("catches an offer of a refund", () => {
    const violations = validateReply(
      "We are so sorry about this. We would like to offer you a refund for the meal.",
      validator,
    );
    expect(violations.map((v) => v.code)).toContain("NO_COMPENSATION");
  });

  it("catches a free item and a meal on the house", () => {
    expect(
      validateReply("Your next dessert is on the house.", validator).map(
        (v) => v.code,
      ),
    ).toContain("NO_COMPENSATION");

    expect(
      validateReply("Come back and have a free meal with us.", validator).map(
        (v) => v.code,
      ),
    ).toContain("NO_COMPENSATION");
  });

  it("catches an admission of fault", () => {
    const violations = validateReply(
      "That was our fault entirely and we failed to look after you.",
      validator,
    );
    expect(violations.map((v) => v.code)).toContain("NO_FAULT");
  });

  it("catches an absolute guarantee", () => {
    expect(
      validateReply("This will never happen again, we guarantee it.", validator)
        .map((v) => v.code),
    ).toContain("NO_GUARANTEE");

    expect(
      validateReply("You have my word on that.", validator).map((v) => v.code),
    ).toContain("NO_GUARANTEE");
  });

  it("catches a named employee", () => {
    const violations = validateReply(
      "We have spoken with Maria about how your table was handled.",
      validator,
    );
    const named = violations.find((v) => v.code === "NO_NAMES");
    expect(named?.pattern).toBe("Maria");
  });

  it("allows the business name and the reviewer's name", () => {
    const violations = validateReply(
      "Thank you, Dana. Everyone at Corner Table Bistro appreciated this.",
      validator,
    );
    expect(violations).toHaveLength(0);
  });

  it("does not treat a sentence's first word as a name", () => {
    const violations = validateReply(
      "Thanks for writing. Wednesday evenings are our busiest. Hope to see you soon.",
      validator,
    );
    expect(violations.filter((v) => v.code === "NO_NAMES")).toHaveLength(0);
  });

  it("lets a reply decline a refund without flagging it", () => {
    // The rule is against committing money, not against the word. Declining is
    // the opposite of committing.
    const violations = validateReply(
      "We are not able to offer a refund for a meal that was eaten, but we would still like to hear more at hello@cornertable.com.",
      validator,
    );
    expect(violations).toHaveLength(0);
  });

  it("still catches a commitment in a sentence that also says 'can't'", () => {
    const violations = validateReply(
      "We can't wait to see you again, and your next dessert is on us.",
      validator,
    );
    expect(violations.map((v) => v.code)).toContain("NO_COMPENSATION");
  });

  it("reports every rule a reply breaks, not just the first", () => {
    const codes = validateReply(
      "This was our fault. Here is a refund, and it will never happen again.",
      validator,
    ).map((v) => v.code);

    expect(new Set(codes)).toEqual(
      new Set(["NO_FAULT", "NO_COMPENSATION", "NO_GUARANTEE"]),
    );
  });

  it("passes a clean reply", () => {
    const violations = validateReply(
      "Thank you for telling us, Dana. A forty-minute wait on a booked table is not the evening we want anyone to have, and we are looking at how we hold reservations at our busiest hours. If you would like to talk it through, we are at hello@cornertable.com.",
      validator,
    );
    expect(violations).toHaveLength(0);
  });

  // Both of these were found by seeding against the live API, not by reading
  // the code. They are here so they cannot come back.
  it("treats a word after Spanish opening punctuation as sentence-initial", () => {
    const violations = validateReply(
      "¡Muchas gracias por visitarnos! Nos alegra que te haya gustado.",
      { ...validator, reviewerName: "Carlos R.", language: "es" },
    );
    expect(violations).toHaveLength(0);
  });

  it("does not run the name heuristic on a language that capitalizes nouns", () => {
    // Every noun here is capitalized because that is what German does. Flagging
    // them would fail the reply twice and hand the operator a manual reply that
    // never needed to be one.
    const violations = validateReply(
      "Vielen Dank für Ihren Besuch und Ihre Rückmeldung zum Service.",
      { ...validator, reviewerName: "Anna S.", language: "de" },
    );
    expect(violations.filter((v) => v.code === "NO_NAMES")).toHaveLength(0);
  });

  it("still catches a money commitment in a non-English reply", () => {
    // Only the capitalization heuristic is language-dependent. The rules that
    // match on actual words keep running, whatever the language.
    const violations = validateReply(
      "Gracias por avisarnos. We will send you a refund for the meal.",
      { ...validator, language: "es" },
    );
    expect(violations.map((v) => v.code)).toContain("NO_COMPENSATION");
  });

  it("keeps checking names in English replies", () => {
    const violations = validateReply(
      "We have spoken with Maria about your table.",
      { ...validator, language: "en" },
    );
    expect(violations.map((v) => v.code)).toContain("NO_NAMES");
  });

  it("does not split a sentence on the dot inside an email address", () => {
    const sentences = splitSentences(
      "Thanks for writing. Reach us at hello@cornertable.com.",
    );
    expect(sentences).toHaveLength(2);
    expect(sentences[1].text).toBe("Reach us at hello@cornertable.com.");
  });

  it("quotes the whole offending sentence, so the repair prompt has context", () => {
    const violations = validateReply(
      "Thanks for the feedback. Your next meal is on us. We hope to see you.",
      validator,
    );
    expect(violations[0].excerpt).toBe("Your next meal is on us.");
  });
});

// ---------------------------------------------------------------------------
// Plain text
// ---------------------------------------------------------------------------

describe("replies are plain text", () => {
  // Found in a real French draft: the model wrote correct HTML into a field
  // that is posted verbatim under a review.
  it("decodes named HTML entities", () => {
    expect(toPlainReply("Merci pour votre partage, Am&eacute;lie.")).toBe(
      "Merci pour votre partage, Amélie.",
    );
  });

  it("decodes numeric and hex entities", () => {
    expect(toPlainReply("Gr&#225;cias &#x263A;")).toBe("Grácias ☺");
  });

  it("unwinds a double-encoded entity", () => {
    expect(toPlainReply("Am&amp;eacute;lie")).toBe("Amélie");
  });

  it("leaves an ampersand the customer would legitimately read", () => {
    expect(toPlainReply("Fish & chips, and R&D too.")).toBe(
      "Fish & chips, and R&D too.",
    );
  });

  it("leaves an entity it does not know rather than guessing", () => {
    expect(toPlainReply("Prices in &fakeent; terms")).toBe(
      "Prices in &fakeent; terms",
    );
  });

  it("strips Markdown emphasis wrapped around the whole reply", () => {
    expect(toPlainReply("**Thanks for visiting!**")).toBe(
      "Thanks for visiting!",
    );
  });

  it("normalizes through the generation schema, before validation", () => {
    const parsed = generationResult.parse({
      reply: "We&apos;ve noted it. Ask for a refund at the desk.",
      themes: [],
      toneUsed: "Warm",
      language: "en",
      reasoning: "",
    });

    expect(parsed.reply).toBe("We've noted it. Ask for a refund at the desk.");
    // The validator sees decoded text, so an entity cannot hide a violation.
    expect(
      validateReply(parsed.reply, validator).map((v) => v.code),
    ).toContain("NO_COMPENSATION");
  });
});

// ---------------------------------------------------------------------------
// Stage 3 + 4 — the repair loop
// ---------------------------------------------------------------------------

describe("generation and auto-repair", () => {
  it("returns the first attempt when it is already clean", async () => {
    const ai = mockAi({
      classify: classification("NONE", 0, ""),
      generate: [
        generated("Thank you for telling us. We are looking at how tables are held at our busiest hours.", {
          themes: ["wait time", "reservations"],
        }),
      ],
    });

    const outcome = await runPipeline(review({ rating: 2 }), context(ai));
    const drafted = expectRoute(outcome, "GENERATE");

    expect(drafted.outcome).toBe("drafted");
    if (drafted.outcome !== "drafted") return;
    expect(drafted.repairs).toHaveLength(0);
    expect(drafted.themes).toEqual(["wait time", "reservations"]);
    expect(ai.generateCalls()).toBe(1);
  });

  it("repairs on the second attempt and reports what changed", async () => {
    const ai = mockAi({
      classify: classification("NONE", 0, ""),
      generate: [
        generated(
          "We are sorry about the wait. Please come back and let us make it right with a free meal.",
        ),
        generated(
          "We are sorry about the wait. If you would like to talk it through, we are at hello@cornertable.com.",
        ),
      ],
    });

    const outcome = await runPipeline(review({ rating: 1 }), context(ai));
    const drafted = expectRoute(outcome, "GENERATE");

    expect(drafted.outcome).toBe("drafted");
    if (drafted.outcome !== "drafted") return;

    expect(ai.generateCalls()).toBe(2);
    expect(drafted.repairs).toHaveLength(1);
    expect(drafted.repairs[0].code).toBe("NO_COMPENSATION");
    expect(drafted.repairs[0].note).toBe(
      "Adjusted: an offer of compensation was removed.",
    );
    expect(drafted.repairs[0].removed).toContain("free meal");
    expect(drafted.repairs[0].replaced).toContain("hello@cornertable.com");
    // The reply the operator sees is the repaired one, and it is clean.
    expect(validateReply(drafted.reply, validator)).toHaveLength(0);
  });

  it("quotes the broken rule and the offending sentence in the repair prompt", async () => {
    const ai = mockAi({
      classify: classification("NONE", 0, ""),
      generate: [
        generated("Your next meal is on us."),
        generated("Thank you for the feedback, we are looking into it."),
      ],
    });

    await runPipeline(review({ rating: 1 }), context(ai));

    const repairPrompt = ai.calls.find(
      (c) => c.label === "generate:repair",
    )?.prompt;
    expect(repairPrompt).toContain("Your next meal is on us.");
    expect(repairPrompt).toContain("refund");
  });

  it("stops after two attempts and asks for a manual reply", async () => {
    const ai = mockAi({
      classify: classification("NONE", 0, ""),
      generate: [
        generated("This was our fault and your meal is on us."),
        generated("We admit we got it wrong, so here is a discount."),
        generated("A third attempt that must never be made."),
      ],
    });

    const outcome = await runPipeline(review({ rating: 1 }), context(ai));
    const result = expectRoute(outcome, "GENERATE");

    expect(result.outcome).toBe("needs_manual_reply");
    if (result.outcome !== "needs_manual_reply") return;

    // Exactly two. Never a third.
    expect(ai.generateCalls()).toBe(2);
    expect(result.attempts).toHaveLength(2);
    // Both attempts are kept, so the screen can show what we tried.
    expect(result.attempts[0].result.reply).toContain("on us");
    expect(result.attempts[1].result.reply).toContain("discount");
    expect(result.violations.length).toBeGreaterThan(0);
  });

  it("never shows a draft that broke a rule twice", async () => {
    const ai = mockAi({
      classify: classification("NONE", 0, ""),
      generate: [
        generated("Here is a refund."),
        generated("Here is a voucher."),
      ],
    });

    const outcome = await runPipeline(review({ rating: 1 }), context(ai));
    const result = expectRoute(outcome, "GENERATE");

    expect(result.outcome).toBe("needs_manual_reply");
    expect(result).not.toHaveProperty("reply");
  });

  it("pauses rather than failing when the daily budget is spent", async () => {
    const ai = mockAi({
      classify: classification("NONE", 0, ""),
      generate: [new AiBudgetExhaustedError("gemini-2.5-flash")],
    });

    const outcome = await runPipeline(review({ rating: 2 }), context(ai));
    const result = expectRoute(outcome, "GENERATE");

    expect(result.outcome).toBe("paused");
  });

  it("reports a call failure without marking the review unanswerable", async () => {
    const ai = mockAi({
      classify: classification("NONE", 0, ""),
      generate: [new Error("The generate call failed: HTTP 500.")],
    });

    const outcome = await runPipeline(review({ rating: 2 }), context(ai));
    const result = expectRoute(outcome, "GENERATE");

    expect(result.outcome).toBe("failed");
    if (result.outcome !== "failed") return;
    expect(result.reason).toContain("500");
  });

  it("tells the model the brand voice and the follow-up address", async () => {
    const ai = mockAi({
      classify: classification("NONE", 0, ""),
      generate: [generated("Thanks for this.")],
    });

    await runPipeline(
      review({ rating: 2 }),
      context(ai, {
        brandVoice: {
          tone: "Concise",
          alwaysMention: "family-owned since 1998",
          contactEmail: "hello@cornertable.com",
        },
      }),
    );

    expect(ai.generateCalls()).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// The invariant that matters most
// ---------------------------------------------------------------------------

describe("escalated reviews never reach the generator", () => {
  const escalating = [
    "My daughter was sick for two days and we are speaking to a lawyer.",
    "Staff refused to serve us and I can only think of one reason why.",
    "There was a cockroach on the table.",
    "I was assaulted by a member of staff.",
    "They stole my card details.",
  ];

  it.each(escalating)("drafts nothing for: %s", async (text) => {
    const ai = mockAi();
    const outcome = await runPipeline(
      review({ text, rating: 1 }),
      context(ai),
    );

    expectRoute(outcome, "ESCALATE");
    expect(ai.generateCalls()).toBe(0);
  });

  it("drafts nothing when the classifier escalates", async () => {
    const ai = mockAi({
      classify: classification("MINOR_SAFETY", 0.7, "left him by the fryers"),
    });

    const outcome = await runPipeline(
      review({ text: "They left him by the fryers with nobody watching.", rating: 1 }),
      context(ai),
    );

    expectRoute(outcome, "ESCALATE");
    expect(ai.generateCalls()).toBe(0);
  });
});
