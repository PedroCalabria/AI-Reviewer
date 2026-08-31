# Review Desk

An implementation of the **AI Review Responder v2** Claude Design canvas: a desk
where drafted replies to Google Business Profile reviews wait for a human to
approve them. Nothing publishes on its own, guardrails strip anything that would
commit the business to a refund or an admission of fault, and reviews that
mention a legal threat, discrimination, or a health-and-safety claim are
escalated with no draft at all.

Built with Next.js (App Router) and TypeScript.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build
npm run lint
```

## Screens

| Route            | What it is                                                            |
| ---------------- | --------------------------------------------------------------------- |
| `/signin`        | Google connect, with the scopes stated up front                        |
| `/onboarding`    | Three steps: account → location → brand voice and guardrails           |
| `/inbox`         | The queue, with filter rail, bulk template approval, keyboard nav      |
| `/inbox/[id]`    | One review: the text on the left, the lane-specific reply on the right |
| `/settings`      | Brand voice, auto-approve, guardrails, connected account, sync         |
| `/activity`      | Every sync, draft, guardrail rewrite, escalation, and publish          |
| `/design-system` | The token reference sheet — ink ramp, type roles, controls             |

`/` redirects to `/signin`. `/design-system` is a reference page and is
deliberately not linked from the product chrome.

### Inbox keyboard shortcuts

`J` / `K` move the cursor, `A` approves the row under it, `E` or `Enter` opens it.

## The three lanes

Every review lands in exactly one lane, and the lane decides what the detail
screen offers:

- **generated** — an AI draft, editable, with the guardrail diff (“what was
  removed, what was written instead”) and a regenerate control with a tone
  override.
- **template** — a rating with no text gets a rotating thank-you. No model runs,
  so these can be cleared in bulk from the inbox.
- **escalated** — a black slab, no draft. The operator writes it themselves,
  marks it handled, or copies it out.

## Layout

```
app/
  tokens/*.css        Journal X design tokens, one file per axis
  globals.css         token imports + the two global keyframes
  (desk)/             the sidebar shell: inbox, review detail, settings, activity
  signin/ onboarding/ the pre-desk flow, no sidebar
  design-system/      token reference sheet
components/
  ds/                 the Journal X primitives: Button, Badge, Input,
                      IconButton, SectionHeading, MetaLine, Icon
  app/                desk-specific pieces: Sidebar, ReviewRow, ReviewDetail,
                      ToneCards, Chip, Toast
lib/
  data.ts             seed reviews, tones, guardrails, templates, activity log
  draft.ts            draft regeneration — the seam for a real model call
  store.tsx           the desk session: one client context over all screens
  types.ts
```

## Where the design was implemented rather than copied

The source file is a single-page design canvas, so a few things became real
application concerns:

- **Routing replaces the screen switcher.** The canvas had a tab rail across the
  top to jump between the seven artboards. Each artboard is now a route, and
  navigation happens through the sidebar and the flow buttons.
- **Counts are derived, not fixed.** The canvas showed a 31-review backlog
  against 8 sample rows. Every count here — the filter chips, the sidebar badge,
  the headline, the bulk-approve bar — is computed from the actual queue.
- **Fonts are self-hosted.** The design system pulled Plus Jakarta Sans and the
  Lucide glyphs from CDNs; both now come from the bundle (`next/font/google`
  and `lucide-react`), so nothing is fetched from a third party at runtime.
- **`rowDensity` is fixed at comfortable.** It was a canvas editor prop rather
  than product UI.

## What is stubbed

The desk runs entirely in the browser against the seed data in `lib/data.ts`,
so the queue resets on reload. Three seams are marked in the code and need a
backend before this is a live product:

- `lib/store.tsx` → `syncNow` — where the Business Profile pull, triage, and
  draft pass belong.
- `lib/draft.ts` → `regenerateDraft` — where the model call belongs. It takes
  the review, the selected tone, and should return a guardrail-checked draft.
- Publishing marks the review published locally; it does not post the reply.

Authentication is not wired up either: “Continue with Google” walks into
onboarding without an OAuth round trip.
