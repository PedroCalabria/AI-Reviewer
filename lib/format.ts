/**
 * Date and text formatting for the desk screens.
 *
 * All of it lives here so a component never holds a Date, and so "2 minutes
 * ago" is computed in one place rather than in four.
 */

const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

/** "2 minutes ago", "yesterday", "3 months ago". */
export function relativeTime(from: Date, now: Date = new Date()): string {
  const elapsed = from.getTime() - now.getTime();
  const magnitude = Math.abs(elapsed);

  if (magnitude < 45_000) return "just now";

  for (const [unit, ms] of UNITS) {
    if (magnitude >= ms) {
      return RELATIVE.format(Math.round(elapsed / ms), unit);
    }
  }

  return "just now";
}

/** "Aug 28, 2026" */
export function shortDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

/** "Aug 30 · 09:02" — the activity log's stamp. */
export function logStamp(date: Date): string {
  const day = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  return `${day} · ${time}`;
}

/**
 * The avatar letter. Falls back to a dash rather than an empty circle for the
 * reviews that come through with no name at all.
 */
export function initialOf(name: string): string {
  const first = name.trim()[0];
  return first ? first.toUpperCase() : "—";
}

/** "SO" from "Sarah Okonkwo", "DE" from "demo@cornertable.com". */
export function initialsOf(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return email.slice(0, 2).toUpperCase();
}

/**
 * "Review 8841" — the provider's ID, trimmed to something a person can read
 * back over the phone. Provider IDs are long opaque strings; the tail is the
 * part that differs.
 */
export function reviewNumber(externalId: string): string {
  const tail = externalId.replace(/[^A-Za-z0-9]/g, "").slice(-5);
  return `Review ${tail || externalId}`;
}

export function pluralize(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}
