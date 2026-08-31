/**
 * In-memory rate limiting for credentials sign-in.
 *
 * Deliberately not a database table and not Redis. It exists to stop somebody
 * grinding passwords against the demo account, and losing its state on a
 * restart or splitting it across serverless instances is an acceptable cost for
 * that. Anything stronger would mean adding infrastructure this project has no
 * other need for.
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

const attempts = new Map<string, number[]>();

function recent(key: string, now: number): number[] {
  const times = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (times.length) attempts.set(key, times);
  else attempts.delete(key);
  return times;
}

export function isRateLimited(identifier: string): boolean {
  const key = identifier.toLowerCase();
  return recent(key, Date.now()).length >= MAX_ATTEMPTS;
}

export function recordFailedAttempt(identifier: string): void {
  const key = identifier.toLowerCase();
  const now = Date.now();
  attempts.set(key, [...recent(key, now), now]);
}

export function clearAttempts(identifier: string): void {
  attempts.delete(identifier.toLowerCase());
}

/** Minutes until the caller may try again. */
export function retryAfterMinutes(identifier: string): number {
  const times = recent(identifier.toLowerCase(), Date.now());
  if (!times.length) return 0;
  const oldest = Math.min(...times);
  return Math.max(1, Math.ceil((WINDOW_MS - (Date.now() - oldest)) / 60000));
}
