import type {
  Guardrail,
  InboxFilter,
  Location,
  LogEntry,
  LogFilter,
  SeedReview,
  Tone,
} from "./types";

export const ACCOUNT = {
  name: "Sarah Okonkwo",
  email: "sarah@cornertable.com",
  initials: "SO",
  connectedOn: "Aug 12, 2026",
};

export const LOCATIONS: Location[] = [
  {
    id: 1,
    name: "Corner Table Bistro",
    address: "412 W 3rd St, Austin TX",
    reviewCount: 218,
    unanswered: 31,
  },
  {
    id: 2,
    name: "Corner Table — Domain",
    address: "11410 Century Oaks Ter, Austin TX",
    reviewCount: 96,
    unanswered: 12,
  },
];

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
    example: "Thanks for the feedback, Dana. We'll look at our coffee temperature.",
  },
  {
    name: "Playful",
    desc: "Light and informal. Fits casual brands.",
    example:
      "Brunch win, coffee not quite hot enough — noted. We'll turn up the heat for next time. Thanks for stopping by, Dana!",
  },
];

export const GUARDRAILS: Guardrail[] = [
  {
    code: "NO_COMPENSATION",
    text: "We never offer a refund, a discount, or a free item.",
    example: "Come back this week and your next meal is on us.",
  },
  {
    code: "NO_FAULT",
    text: "We never admit that your business was at fault.",
    example: "You're right, we completely failed you that night.",
  },
  {
    code: "NO_GUARANTEE",
    text: "We never promise that a problem won't happen again.",
    example: "This will never happen again.",
  },
  {
    code: "NO_NAMES",
    text: "We never name an employee or another business.",
    example: "I've spoken with Maria about how she treated you.",
  },
];

/** Rotating thank-yous for ratings with no text. No model runs on these. */
export const TEMPLATES = [
  "Thank you for the five stars — we appreciate you taking the time.",
  "Thanks so much for the rating! We're glad you enjoyed your visit.",
  "Five stars, thank you. It means a lot to the whole team.",
];

export const BASE_REVIEWS: SeedReview[] = [
  {
    id: "r1",
    stars: 1,
    name: "Marcus D.",
    initial: "M",
    date: "Aug 28, 2023",
    meta: "Review 8841 · Aug 28, 2023",
    text: "Waited 40 minutes for a table we had booked and the woman at the counter never once looked up at us.",
    lane: "generated",
    themes: ["wait time", "staff attentiveness"],
    draft:
      "Marcus, thank you for telling us. A 40-minute wait on a table you had booked isn't the experience we want anyone to have, and it sounds like the welcome fell short too. We're reviewing how we hold reservations during our busiest hours. If you'd like to talk it through, you can reach us at hello@cornertable.com.",
    adjust: {
      note: "Adjusted: an offer of compensation was removed.",
      rule: "NO_COMPENSATION",
      removed:
        "Please come back and let us make it right with a complimentary dinner for two.",
      replaced:
        "If you'd like to talk it through, you can reach us at hello@cornertable.com.",
    },
  },
  {
    id: "r2",
    stars: 5,
    name: "Priya N.",
    initial: "P",
    date: "Aug 28, 2023",
    meta: "Review 8840 · Aug 28, 2023",
    text: "",
    lane: "template",
    themes: [],
  },
  {
    id: "r3",
    stars: 1,
    name: "Anonymous",
    initial: "A",
    date: "Aug 27, 2023",
    meta: "Review 8836 · Aug 27, 2023",
    text: "My daughter was sick for two days after eating here. We're speaking to a lawyer.",
    lane: "escalated",
    category: "Legal threat",
    trigger: "We're speaking to a lawyer",
    rule: "Legal threat",
    escalationCopy:
      "This review mentions a legal threat, and an automated response could work against you. Write this one yourself, or forward it.",
    themes: ["illness claim", "legal"],
  },
  {
    id: "r4",
    stars: 3,
    name: "Tom B.",
    initial: "T",
    date: "Aug 27, 2023",
    meta: "Review 8835 · Aug 27, 2023",
    text: "Food was great, honestly. But it took over an hour and the place was half empty.",
    lane: "generated",
    themes: ["wait time", "service pace"],
    draft:
      "Tom, thank you — we're glad the food landed well. Over an hour is too long, especially on a quiet night, and we're looking at how tickets move between the kitchen and the floor. We appreciate you flagging it.",
    adjust: {
      note: "Adjusted: an offer of a free dessert was removed.",
      rule: "NO_COMPENSATION",
      removed: "Next time you're in, dessert is on the house.",
      replaced: "We appreciate you flagging it.",
    },
  },
  {
    id: "r5",
    stars: 5,
    name: "Elena R.",
    initial: "E",
    date: "Aug 26, 2023",
    meta: "Review 8829 · Aug 26, 2023",
    text: "Perfect",
    lane: "template",
    themes: [],
  },
  {
    id: "r6",
    stars: 2,
    name: "J. Whitfield",
    initial: "J",
    date: "Aug 25, 2023",
    meta: "Review 8814 · Aug 25, 2023",
    text: "Staff refused to seat us and I can only think of one reason why.",
    lane: "escalated",
    category: "Discrimination",
    trigger: "I can only think of one reason why",
    rule: "Discrimination",
    escalationCopy:
      "This review implies discrimination, and an automated response could work against you. Write this one yourself, or forward it.",
    themes: ["seating", "staff conduct"],
  },
  {
    id: "r7",
    stars: 4,
    name: "Dana K.",
    initial: "D",
    date: "Aug 24, 2023",
    meta: "Review 8801 · Aug 24, 2023",
    text: "Great brunch spot. Coffee could be hotter.",
    lane: "generated",
    themes: ["food quality", "beverage temperature"],
    draft:
      "Thanks for the kind words about brunch, Dana! We're glad it hit the spot, and we'll keep a closer eye on how hot the coffee goes out. Hope to see you again soon.",
  },
  {
    id: "r8",
    stars: 1,
    name: "Reza M.",
    initial: "R",
    date: "Aug 24, 2023",
    meta: "Review 8798 · Aug 24, 2023",
    text: "Found a hair in the pasta and the manager argued with me about it.",
    lane: "escalated",
    category: "Health and safety",
    trigger: "Found a hair in the pasta",
    rule: "Health and safety",
    escalationCopy:
      "This review makes a health and safety claim, and an automated response could work against you. Write this one yourself, or forward it.",
    themes: ["hygiene", "staff conduct"],
  },
];

export const BASE_LOG: LogEntry[] = [
  {
    time: "Aug 30 · 09:02",
    actor: "System",
    type: "Sync",
    text: "Synced 14 new reviews from Corner Table Bistro",
  },
  {
    time: "Aug 30 · 09:02",
    actor: "AI",
    type: "AI",
    text: "Drafted reply for Marcus D. (one star)",
  },
  {
    time: "Aug 30 · 09:02",
    actor: "System",
    type: "Escalation",
    text: "Escalated review from Anonymous — legal threat detected",
  },
  {
    time: "Aug 30 · 09:03",
    actor: "Guardrail",
    type: "Guardrail",
    text: "Rewrote draft for Tom B. — removed offer of a free dessert",
  },
  {
    time: "Aug 30 · 09:03",
    actor: "AI",
    type: "AI",
    text: "Drafted reply for Dana K. (four stars)",
  },
  {
    time: "Aug 30 · 09:11",
    actor: "Sarah",
    type: "You",
    text: "Approved and published reply to Dana K.",
  },
  {
    time: "Aug 30 · 09:12",
    actor: "Sarah",
    type: "You",
    text: "Approved 12 template replies",
  },
  {
    time: "Aug 29 · 17:40",
    actor: "System",
    type: "Escalation",
    text: "Escalated review from J. Whitfield — discrimination detected",
  },
  {
    time: "Aug 29 · 03:00",
    actor: "System",
    type: "Sync",
    text: "Synced 6 new reviews from Corner Table — Domain",
  },
  {
    time: "Aug 28 · 14:22",
    actor: "Sarah",
    type: "You",
    text: "Edited draft for Marcus D. before publishing",
  },
];

export const INBOX_FILTERS: InboxFilter[] = [
  "Needs review",
  "Escalated",
  "Approved",
  "Published",
  "All",
];

export const LOG_FILTERS: LogFilter[] = [
  "All",
  "Sync",
  "AI",
  "Guardrail",
  "Escalation",
  "You",
];

export const SYNC_COPY = {
  last: "Synced 14 minutes ago",
  next: "next sync at 15:00",
  cadence: "Every six hours",
};
