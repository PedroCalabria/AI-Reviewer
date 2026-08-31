import type { ProviderLocation, ProviderReview } from "./ReviewProvider";

/**
 * The synthetic corpus behind FakeReviewProvider.
 *
 * The distribution is the demo, not the volume. Fifty reviews, deliberately
 * shaped so that opening the inbox exercises every lane:
 *
 *   12  four and five stars with nothing or almost nothing written  → template
 *    6  escalations, one per category, three with no trigger phrase → escalate
 *    8  several complaints in one review                            → themes
 *    3  written in another language
 *   21  spread across the remaining ratings and tones
 *
 * Dates are spread across the last 90 days relative to whenever the seed runs,
 * so the inbox looks lived-in rather than all posted on the same afternoon. The
 * spread itself is deterministic: `daysAgo` is fixed per review and the time of
 * day comes from a seeded PRNG, so two seed runs produce the same ordering.
 */

export const FIXTURE_LOCATIONS: ProviderLocation[] = [
  {
    externalId: "locations/11429381746",
    name: "Corner Table Bistro",
    address: "412 W 3rd St, Austin TX",
  },
  {
    externalId: "locations/11429381822",
    name: "Corner Table — Domain",
    address: "11410 Century Oaks Ter, Austin TX",
  },
];

type Fixture = {
  /** 0 or 1: which location this review belongs to. */
  location: 0 | 1;
  author: string;
  rating: number;
  text: string;
  daysAgo: number;
  language?: string;
};

/**
 * mulberry32 — a small, fast, fully deterministic PRNG. Used only for the time
 * of day on each review, so that "deterministic seed" means what it says.
 */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const FIXTURE_SEED = 20260830;

const FIXTURES: Fixture[] = [
  // --- Escalations: one per category ---------------------------------------
  {
    location: 0,
    author: "Anonymous",
    rating: 1,
    text: "My daughter was sick for two days after eating here. We are speaking to a lawyer about it.",
    daysAgo: 2,
  },
  {
    location: 0,
    author: "Reza M.",
    rating: 1,
    text: "There was a cockroach on the wall right beside our table. We left without eating anything.",
    daysAgo: 6,
  },
  {
    location: 0,
    author: "J. Whitfield",
    rating: 1,
    text: "The host refused to serve us and made it very clear why. I have never been treated like that anywhere.",
    daysAgo: 11,
  },
  // The three below carry no trigger phrase at all. The keyword list cannot
  // reach them; the classifier has to earn the escalation.
  {
    location: 0,
    author: "Danielle O.",
    rating: 1,
    text: "A man on the door put his hand on my partner and pushed him into the railing on the way out. Nobody said a word about it.",
    daysAgo: 4,
  },
  {
    location: 0,
    author: "Kwame A.",
    rating: 1,
    text: "The man behind the bar was slurring his words and could not work the till. He gave three tables the wrong change while we watched.",
    daysAgo: 17,
  },
  {
    location: 0,
    author: "Bethan L.",
    rating: 2,
    text: "My five year old walked straight past the pass and stood next to the fryer before anyone noticed him. I do not know how that is allowed to happen.",
    daysAgo: 23,
  },

  // --- Template lane: good ratings, little or nothing written ---------------
  { location: 0, author: "Priya N.", rating: 5, text: "", daysAgo: 1 },
  { location: 0, author: "Elena R.", rating: 5, text: "Perfect", daysAgo: 3 },
  { location: 0, author: "Miguel S.", rating: 5, text: "", daysAgo: 5 },
  { location: 0, author: "Tara J.", rating: 4, text: "Lovely", daysAgo: 8 },
  { location: 0, author: "Chen W.", rating: 5, text: "Great food", daysAgo: 12 },
  { location: 0, author: "Aoife B.", rating: 5, text: "", daysAgo: 19 },
  { location: 0, author: "Sam T.", rating: 5, text: "Best in town", daysAgo: 26 },
  { location: 0, author: "Nadia H.", rating: 4, text: "Solid", daysAgo: 34 },
  { location: 1, author: "Owen P.", rating: 5, text: "", daysAgo: 7 },
  { location: 1, author: "Ines V.", rating: 5, text: "Always great", daysAgo: 15 },
  { location: 1, author: "Josh D.", rating: 4, text: "Good", daysAgo: 29 },
  { location: 1, author: "Marta K.", rating: 5, text: "So good", daysAgo: 41 },

  // --- Several complaints in one review, for theme extraction --------------
  {
    location: 0,
    author: "Marcus D.",
    rating: 1,
    text: "Waited forty minutes for a table we had booked, the woman at the counter never once looked up at us, and when the food came the fish was cold in the middle.",
    daysAgo: 2,
  },
  {
    location: 0,
    author: "Tom B.",
    rating: 3,
    text: "Food was genuinely good. But it took over an hour to arrive, the place was half empty, and the music was loud enough that we gave up talking.",
    daysAgo: 3,
  },
  {
    location: 0,
    author: "Ruth E.",
    rating: 2,
    text: "Parking is a nightmare, the table was sticky when we sat down, and two of the four dishes we ordered arrived at completely different times.",
    daysAgo: 9,
  },
  {
    location: 0,
    author: "Adeola F.",
    rating: 2,
    text: "The starter was excellent and then everything went downhill. Main was under-seasoned, the bill had a drink on it we never ordered, and it took twenty minutes to get anyone's attention to fix it.",
    daysAgo: 14,
  },
  {
    location: 0,
    author: "Henry G.",
    rating: 3,
    text: "Good value and the bread is great. Bathroom was out of order the whole evening though, and the front door lets in a freezing draught right onto table six.",
    daysAgo: 21,
  },
  {
    location: 1,
    author: "Sofia N.",
    rating: 2,
    text: "Booked for a birthday, they lost the booking, then squeezed us onto a table by the kitchen door. Food was fine but the whole evening felt like an inconvenience to them.",
    daysAgo: 13,
  },
  {
    location: 1,
    author: "Blake R.",
    rating: 3,
    text: "Portions have shrunk, prices have gone up, and the service is slower than it was last year. Still the best coffee on this side of town though.",
    daysAgo: 27,
  },
  {
    location: 0,
    author: "Lena M.",
    rating: 2,
    text: "Ordered the special, they ran out halfway through taking our order, the replacement took ages and nobody mentioned it was ten dollars more until the bill.",
    daysAgo: 38,
  },

  // --- Not in English ------------------------------------------------------
  {
    location: 0,
    author: "Carlos R.",
    rating: 4,
    text: "La comida estuvo muy buena y el personal fue amable, pero esperamos casi una hora por la mesa que habíamos reservado.",
    daysAgo: 10,
    language: "es",
  },
  {
    location: 0,
    author: "Amélie D.",
    rating: 2,
    text: "Le service était très lent et notre plat est arrivé froid. Dommage, car le cadre est vraiment agréable.",
    daysAgo: 25,
    language: "fr",
  },
  {
    location: 1,
    author: "Paulo M.",
    rating: 5,
    text: "Comemos muito bem, o atendimento foi excelente e voltaremos com certeza na próxima vez que estivermos na cidade.",
    daysAgo: 33,
    language: "pt",
  },

  // --- The rest: spread across ratings and tones ---------------------------
  {
    location: 0,
    author: "Dana K.",
    rating: 4,
    text: "Great brunch spot. The coffee could be a good deal hotter than it was.",
    daysAgo: 6,
  },
  {
    location: 0,
    author: "Ollie W.",
    rating: 5,
    text: "Came for an anniversary dinner and they could not have looked after us better. The lamb was the best thing I have eaten this year.",
    daysAgo: 4,
  },
  {
    location: 0,
    author: "Greg H.",
    rating: 1,
    text: "Booked a table for eight and they gave it away because we were ten minutes late.",
    daysAgo: 20,
  },
  {
    location: 0,
    author: "Yuki T.",
    rating: 5,
    text: "The vegetarian tasting menu is genuinely thoughtful rather than an afterthought, which is rarer than it should be.",
    daysAgo: 22,
  },
  {
    location: 0,
    author: "Rosa P.",
    rating: 4,
    text: "Really enjoyed it. Would come back for the desserts alone, though the dining room gets loud after eight.",
    daysAgo: 31,
  },
  {
    location: 0,
    author: "Amir K.",
    rating: 1,
    text: "Charged us for a bottle of wine we sent back. Argued about it for ten minutes before removing it.",
    daysAgo: 36,
  },
  {
    location: 0,
    author: "Steph L.",
    rating: 5,
    text: "Third time here this month, which probably says it all. The staff remember what we drink now.",
    daysAgo: 40,
  },
  {
    location: 0,
    author: "Nina C.",
    rating: 3,
    text: "The food is good but the tables are so close together that we heard every word of the argument next to us.",
    daysAgo: 45,
  },
  {
    location: 0,
    author: "Duncan A.",
    rating: 4,
    text: "Solid neighbourhood restaurant. Not doing anything clever, just doing it properly.",
    daysAgo: 49,
  },
  {
    location: 0,
    author: "Hana S.",
    rating: 2,
    text: "The gluten free options were listed on the menu and then unavailable when we asked about all three of them.",
    daysAgo: 54,
  },
  {
    location: 0,
    author: "Patrick O.",
    rating: 5,
    text: "Took my parents for their anniversary and the kitchen sent out a plate with a candle in it without being asked. Small thing, made their night.",
    daysAgo: 58,
  },
  {
    location: 0,
    author: "Zoe F.",
    rating: 1,
    text: "Sat for fifteen minutes without a menu and walked out. Not one person acknowledged us.",
    daysAgo: 63,
  },
  {
    location: 0,
    author: "Ravi N.",
    rating: 4,
    text: "Good cooking and fair prices. Only note is that the wine list has almost nothing under fifty dollars.",
    daysAgo: 69,
  },
  {
    location: 1,
    author: "Claire H.",
    rating: 3,
    text: "It is fine. Convenient if you are already at the shops, not somewhere I would travel for.",
    daysAgo: 18,
  },
  {
    location: 1,
    author: "Tobias E.",
    rating: 5,
    text: "The brunch here is better than the original location and the queue is a fraction of the length.",
    daysAgo: 24,
  },
  {
    location: 1,
    author: "Meera J.",
    rating: 2,
    text: "Ordered at the counter and then waited so long we asked twice whether it had been put through at all.",
    daysAgo: 37,
  },
  {
    location: 1,
    author: "Andrew Q.",
    rating: 4,
    text: "Nice room, good coffee, and the staff are patient with a toddler, which counts for a lot.",
    daysAgo: 44,
  },
  {
    location: 1,
    author: "Priti S.",
    rating: 1,
    text: "Two of us ordered the same dish and only one of them arrived. The other never did.",
    daysAgo: 52,
  },
  {
    location: 1,
    author: "Felix B.",
    rating: 5,
    text: "Best flat white in the Domain and it is not particularly close.",
    daysAgo: 61,
  },
  {
    location: 0,
    author: "Ian D.",
    rating: 4,
    text: "Reliable. Been coming for two years and the only thing that has changed is the prices.",
    daysAgo: 81,
  },
  {
    location: 0,
    author: "Salma R.",
    rating: 5,
    text: "The staff went out of their way to sort a table for us at short notice on a Friday. Genuinely kind service.",
    daysAgo: 88,
  },
];

/** The corpus as provider reviews, with deterministic identifiers and dates. */
export function buildFixtureReviews(now: Date = new Date()): Map<
  string,
  ProviderReview[]
> {
  const random = mulberry32(FIXTURE_SEED);
  const byLocation = new Map<string, ProviderReview[]>(
    FIXTURE_LOCATIONS.map((location) => [location.externalId, []]),
  );

  FIXTURES.forEach((fixture, index) => {
    const location = FIXTURE_LOCATIONS[fixture.location];
    // A stable, provider-shaped identifier. The sync's unique constraint is on
    // (location, externalId), so re-running a sync updates rather than
    // duplicates — the same guarantee the real provider gives us.
    const externalId = `reviews/AbFvOq${String(8000 + index * 7).padStart(5, "0")}`;

    const postedAt = new Date(now);
    postedAt.setDate(postedAt.getDate() - fixture.daysAgo);
    postedAt.setHours(
      10 + Math.floor(random() * 12),
      Math.floor(random() * 60),
      Math.floor(random() * 60),
      0,
    );

    byLocation.get(location.externalId)!.push({
      externalId,
      authorName: fixture.author,
      rating: fixture.rating,
      text: fixture.text,
      language: fixture.language,
      postedAt,
      // Nothing in the corpus has been edited since it was posted.
      updatedAt: postedAt,
    });
  });

  for (const reviews of byLocation.values()) {
    reviews.sort((a, b) => b.postedAt.getTime() - a.postedAt.getTime());
  }

  return byLocation;
}

export const FIXTURE_REVIEW_COUNT = FIXTURES.length;
