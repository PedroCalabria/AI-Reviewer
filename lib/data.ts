import { GUARDRAILS as VOICE_GUARDRAILS, TONES as VOICE_TONES } from "./config/voice";
import type { Guardrail, InboxFilter, LogFilter, Tone } from "./types";

/**
 * Presentation constants for the desk screens.
 *
 * The seed reviews, activity entries, and account that used to live here are
 * gone: all of that comes from the database now. What is left is the filter
 * rails, and the tone and guardrail copy — re-exported from lib/config/voice so
 * that the text on the settings screen and the text in the model's system
 * instruction are the same strings rather than two copies that drift.
 */

export const TONES: Tone[] = VOICE_TONES.map(({ name, desc, example }) => ({
  name,
  desc,
  example,
}));

export const GUARDRAILS: Guardrail[] = VOICE_GUARDRAILS.map(
  ({ code, text, example }) => ({ code, text, example }),
);

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
  "Template",
  "Guardrail",
  "Escalation",
  "You",
];
