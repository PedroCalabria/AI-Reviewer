import type { ToneName } from "@/lib/constants";

/**
 * Canned replies for the template lane: a good rating with little or nothing
 * written. No model runs on these, so they cost nothing and never need a
 * guardrail pass — none of them can commit the business to anything.
 *
 * Eight variants per tone, rotated deterministically by review ID, so a profile
 * does not end up showing four identical replies in a row.
 */
export const TEMPLATES: Record<ToneName, string[]> = {
  Warm: [
    "Thank you for the kind rating — we really appreciate you taking the time.",
    "Thanks so much for this! We're glad you enjoyed your visit.",
    "This made our day. Thank you for stopping by, and for the rating.",
    "Thank you! It means a lot to the whole team to see this.",
    "We appreciate you taking a moment to rate us. Hope to see you again soon.",
    "Thanks for the lovely rating — we're so glad you had a good time with us.",
    "Thank you for this. We'll pass it along to the team.",
    "So glad you enjoyed it. Thanks for the rating, and see you next time.",
  ],
  Professional: [
    "Thank you for your rating. We appreciate you taking the time to share it.",
    "We are grateful for your rating and glad you enjoyed your visit.",
    "Thank you for the positive rating. It is much appreciated.",
    "We appreciate your feedback and are pleased you had a good experience.",
    "Thank you for taking the time to rate us. We hope to welcome you again.",
    "Your rating is appreciated. Thank you for choosing us.",
    "Thank you. We are pleased your visit met your expectations.",
    "We appreciate the rating and look forward to seeing you again.",
  ],
  Concise: [
    "Thanks for the rating — much appreciated.",
    "Thank you. Glad you enjoyed it.",
    "Appreciate the rating. See you next time.",
    "Thanks for taking the time.",
    "Thank you for the rating.",
    "Glad it was a good one. Thanks.",
    "Thanks — hope to see you again.",
    "Much appreciated. Thank you.",
  ],
  Playful: [
    "Thanks for the stars — we'll take them!",
    "This is a great way to start the day. Thanks for the rating!",
    "Rating received and very much appreciated. Thank you!",
    "You're too kind. Thanks for taking a second to rate us!",
    "Well that's lovely. Thanks for stopping by!",
    "Thanks for the rating — the team says hello.",
    "Noted, appreciated, and pinned to the wall. Thank you!",
    "Cheers for the rating. Come back soon!",
  ],
};

/** Every tone has the same number of variants, so this is safe to read once. */
export const TEMPLATE_VARIANT_COUNT = TEMPLATES.Warm.length;

/**
 * Pick a variant from the review's ID rather than at random, so the same review
 * always shows the same reply — across a re-sync, a page reload, and a reseed.
 * A simple FNV-1a hash: the distribution only has to be even across eight
 * buckets, and this keeps the seed reproducible without pulling in a dependency.
 */
export function templateVariantFor(reviewExternalId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < reviewExternalId.length; i++) {
    hash ^= reviewExternalId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % TEMPLATE_VARIANT_COUNT;
}

export function templateText(tone: ToneName, variant: number): string {
  const set = TEMPLATES[tone] ?? TEMPLATES.Warm;
  return set[((variant % set.length) + set.length) % set.length];
}
