import "dotenv/config";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { hash } from "bcryptjs";
import { chromium, type Page } from "playwright";
import { prisma } from "../lib/db";

/**
 * Portfolio capture. Drives the running app with a real browser and writes
 * retina PNGs of every screen worth showing, plus a contact sheet to pick from.
 *
 *   npm run shots                          # captures every screen and the contact sheet
 *   npm run shots -- --port 3400           # port to start on, when nothing is running yet
 *   npm run shots -- --base <url>          # capture a specific server
 *   npm run shots -- --only review         # recapture only the shots whose slug matches
 *
 * It reuses a dev server that is already up for this project — Next 16 runs one
 * per directory and refuses a second — and starts (and kills) its own only when
 * none is running. Either way it verifies the server is this app before it
 * photographs anything.
 *
 * Requires a seeded database (`npm run db:seed`) and Playwright:
 *
 *   npm i -D playwright && npx playwright install chromium
 *
 * Sibling script: scripts/screenshots.mts writes the five images the README
 * embeds. This one writes the wider portfolio set and the contact sheet, and is
 * the only one that starts its own server.
 */

// ─── Configure for this project ──────────────────────────────────────────────

const OUT = join(process.cwd(), "shots");
const VIEWPORT = { width: 1440, height: 900 };
const SCALE = 2; // 2 = retina; the PNGs come out at 2880px wide, plenty for a crop

/** Not the project's usual port — 3000 is usually already answering. */
const DEFAULT_PORT = 3210;

const devArgs = (port: number) => ["run", "dev", "--", "-p", String(port)];

/** The seeded demo tenant. Same defaults as prisma/seed.ts. */
const EMAIL = process.env.DEMO_EMAIL ?? "demo@cornertable.com";
const PASSWORD = process.env.DEMO_PASSWORD ?? "reviewdesk2026";

/** Dev-tooling overlays. They belong to the framework, not the product. */
const HIDE = [
  "nextjs-portal",
  "nextjs-dev-tools-indicator",
  "[data-nextjs-toast]",
  "#webpack-dev-server-client-overlay",
];

/** Contact-sheet copy. */
const COPY = {
  title: "Review Desk — screens",
  lede: (w: number, h: number) =>
    `2× (retina) captures at ${w}×${h}. Each thumbnail is the screen as it appears ` +
    `on the first fold; click it to open the full-page capture, which any section ` +
    `can be cropped out of without losing resolution.`,
  footnote:
    "Synthetic corpus — every reviewer, reply, and location here is invented. " +
    "The one real account is the demo login.",
};

// ─── The shots ───────────────────────────────────────────────────────────────

type Shot = {
  slug: string;
  title: string;
  note: string;
  /** Overlay and typed-into states can't be re-entered for a second capture. */
  viewportOnly?: boolean;
  /**
   * Which browser context to use. The default is signed in as the operator;
   * "anon" has never signed in (the sign-in screen redirects to the inbox for
   * anyone who has), and "onboarding" is the throwaway tenant with no location.
   */
  context?: "anon" | "onboarding";
  /** The location this shot's review belongs to; the desk is scoped to one. */
  locationId?: string;
  arrange: (page: Page) => Promise<void>;
};

/**
 * Built after the database is read, so the deep links point at whatever the
 * current seed produced. Review IDs are cuids and change on every `db:reset`,
 * so hardcoding them would quietly capture 404s.
 */
function buildShots(ids: Ids): Shot[] {
  const shots: Shot[] = [
    {
      slug: "01-signin",
      title: "Sign in",
      note: "The front door. Google is offered when it is configured; the demo tenant uses email and password.",
      context: "anon",
      arrange: goto("/signin"),
    },
    {
      slug: "02-inbox",
      title: "Inbox — the queue",
      note: "The synced reviews for one location, triaged into lanes. The bar offers the template replies as one bulk approval; the counts on the filter rail are live.",
      arrange: async (page) => {
        await goto("/inbox")(page);
      },
    },
    {
      slug: "03-inbox-escalated",
      title: "Inbox — escalated only",
      note: "The lane nothing is drafted for: safety, harm, discrimination and legal-threat reviews, held for a person.",
      arrange: async (page) => {
        await goto("/inbox")(page);
        await page.getByRole("button", { name: /^Escalated \(/ }).click();
        await settle(page, 500);
      },
    },
    {
      slug: "04-inbox-locations",
      title: "Inbox — switching location",
      note: "The queue is scoped to one location. The sidebar switcher moves between the two on the account.",
      viewportOnly: true,
      arrange: async (page) => {
        await goto("/inbox")(page);
        await page.locator('button[aria-haspopup="listbox"]').click();
        await settle(page, 400);
      },
    },
  ];

  if (ids.draft) {
    shots.push({
      slug: "05-review-draft",
      title: "Review — AI draft awaiting approval",
      note: "A mixed review with the drafted reply beside it, editable in place. Nothing publishes without this click.",
      locationId: ids.draft.locationId,
      arrange: goto(`/inbox/${ids.draft.id}`),
    });
  }

  if (ids.guardrail) {
    shots.push({
      slug: "06-review-guardrail-diff",
      title: "Review — what the guardrails removed",
      note: "The draft broke a rule, was repaired, and says so. Expanded: the exact sentence struck out and what was written in its place.",
      locationId: ids.guardrail.locationId,
      arrange: async (page) => {
        await goto(`/inbox/${ids.guardrail.id}`)(page);
        await page.getByRole("button", { name: "See what changed" }).click();
        await settle(page, 400);
      },
    });
  }

  if (ids.escalated) {
    shots.push({
      slug: "07-review-escalated",
      title: "Review — escalated, no draft",
      note: "The classifier fired on a span no keyword list would catch. The evidence is underlined in the review itself, verbatim.",
      locationId: ids.escalated.locationId,
      arrange: goto(`/inbox/${ids.escalated.id}`),
    });

    shots.push({
      slug: "08-review-writing",
      title: "Review — writing it yourself",
      note: "The escalated path: the operator writes, the app only holds the rules it holds the model to. Published as typed.",
      locationId: ids.escalated.locationId,
      arrange: async (page) => {
        await goto(`/inbox/${ids.escalated!.id}`)(page);
        await page.getByRole("button", { name: "Write reply myself" }).click();
        await fillHydrated(
          page,
          "#own-reply",
          `${ids.escalatedName ?? "Hello"}, thank you for telling us. I want to ` +
            "hear exactly what happened, and I am looking into it today. Please " +
            "write to me directly at hello@cornertable.com and I will call you.",
        );
        // The panel opens below the fold. Left unscrolled on purpose: the
        // viewport shot stays the honest first fold, and the full-page capture
        // carries the whole panel — the guardrail reminders and Publish included.
        await settle(page, 400);
      },
    });
  }

  if (ids.multilingual) {
    shots.push({
      slug: "09-review-multilingual",
      title: "Review — answered in the reviewer's language",
      note: "The review came in Spanish, so the draft did too. No setting was touched; the language travels with the review.",
      locationId: ids.multilingual.locationId,
      arrange: goto(`/inbox/${ids.multilingual.id}`),
    });
  }

  if (ids.template) {
    shots.push({
      slug: "10-review-template",
      title: "Review — template reply, no AI",
      note: "Four stars or more with nothing written needs no model. The reply is one of eight variants, and the screen says as much.",
      locationId: ids.template.locationId,
      arrange: goto(`/inbox/${ids.template.id}`),
    });
  }

  shots.push(
    {
      slug: "11-activity",
      title: "Activity log",
      note: "Every sync, draft, guardrail rewrite, escalation and publish, in order. Nothing reaches the profile without an entry.",
      arrange: goto("/activity"),
    },
    {
      slug: "12-activity-escalations",
      title: "Activity log — escalations only",
      note: "The same log filtered to the decisions that stopped the automation, each naming the category that fired.",
      arrange: async (page) => {
        await goto("/activity")(page);
        await page.getByRole("button", { name: "Escalation" }).click();
        await settle(page, 500);
      },
    },
    {
      slug: "13-settings",
      title: "Settings — brand voice and guardrails",
      note: "Tone, the line every reply must carry, and the rules the model cannot write around — stated in the same words the model is given.",
      arrange: goto("/settings"),
    },
    {
      slug: "14-design-tokens",
      title: "Design tokens",
      note: "The system the screens are built from, on its own page: the ink ramp with what each step is for, the type scale in use, and the control set.",
      arrange: goto("/design-system"),
    },
    {
      slug: "15-onboarding-account",
      title: "Onboarding — signed in",
      note: "Step one of three. It confirms which account and which sign-in method, and says what the next two steps do.",
      context: "onboarding",
      arrange: goto("/onboarding"),
    },
    {
      slug: "16-onboarding-location",
      title: "Onboarding — choose a location",
      note: "Step two: the locations the provider reports, with the note that this is switchable later from the sidebar.",
      context: "onboarding",
      arrange: async (page) => {
        await goto("/onboarding")(page);
        await page.getByRole("button", { name: "Continue" }).first().click();
        await settle(page, 400);
      },
    },
    {
      slug: "17-onboarding-voice",
      title: "Onboarding — set the brand voice",
      note: "Step three: tone, with a worked example under each, and the guardrails presented before the first draft is ever written.",
      context: "onboarding",
      arrange: async (page) => {
        await goto("/onboarding")(page);
        await page.getByRole("button", { name: "Continue" }).first().click();
        await settle(page, 300);
        await page.getByRole("button", { name: "Continue" }).first().click();
        await settle(page, 400);
      },
    },
  );

  return shots;
}

// ─── Reading the seed ────────────────────────────────────────────────────────

/** A review to deep-link to, and the location whose queue it lives in. */
type Pick = { id: string; locationId: string };

type Ids = {
  draft?: Pick;
  guardrail?: Pick;
  escalated?: Pick;
  /** First name on the escalated review, so the typed reply addresses them. */
  escalatedName?: string;
  multilingual?: Pick;
  template?: Pick;
};

/**
 * One review per lane, chosen for what it shows rather than for being first:
 * the longest mixed review for the draft shot, the repaired one for the diff,
 * a classifier escalation over a keyword one, a non-English review for the
 * language shot. Every pick falls back to something rather than nothing.
 *
 * Each pick carries its location, because the desk is scoped to one at a time:
 * deep-linking to a review from the other location renders the not-found
 * screen, which is a screenshot that looks like it worked. The runner switches
 * the active location per shot and puts it back afterwards.
 */
async function pickIds(): Promise<Ids> {
  const pick = { select: { id: true, locationId: true } } as const;

  const guardrail = await prisma.review.findFirst({
    where: {
      route: "GENERATE",
      status: "NEEDS_REVIEW",
      guardrailEvents: { some: { outcome: "REPAIRED" } },
    },
    ...pick,
  });

  // Longest text among the middling ratings: a review with something to answer
  // on both sides makes a better draft shot than "Great food".
  const mixed = await prisma.review.findMany({
    where: {
      route: "GENERATE",
      status: "NEEDS_REVIEW",
      rating: { in: [2, 3, 4] },
      drafts: { some: { isCurrent: true } },
      language: null,
      id: guardrail ? { not: guardrail.id } : undefined,
    },
    select: { id: true, locationId: true, text: true },
  });
  const draft = mixed.sort((a, b) => b.text.length - a.text.length)[0];

  const escalated =
    (await prisma.review.findFirst({
      where: {
        route: "ESCALATE",
        escalationTrigger: "classifier",
        escalationCategory: { not: null },
        escalationEvidence: { not: "" },
      },
      select: { id: true, locationId: true, authorName: true },
    })) ??
    (await prisma.review.findFirst({
      where: { route: "ESCALATE" },
      select: { id: true, locationId: true, authorName: true },
    }));

  const multilingual = await prisma.review.findFirst({
    where: {
      route: "GENERATE",
      language: { not: null },
      drafts: { some: { isCurrent: true } },
    },
    ...pick,
  });

  const template =
    (await prisma.review.findFirst({
      where: { route: "TEMPLATE", status: "NEEDS_REVIEW", text: "" },
      ...pick,
    })) ??
    (await prisma.review.findFirst({ where: { route: "TEMPLATE" }, ...pick }));

  const at = (row: { id: string; locationId: string } | null | undefined) =>
    row ? { id: row.id, locationId: row.locationId } : undefined;

  return {
    draft: at(draft),
    guardrail: at(guardrail),
    escalated: at(escalated),
    escalatedName: escalated?.authorName.split(" ")[0],
    multilingual: at(multilingual),
    template: at(template),
  };
}

/**
 * The operator's active location — the one the desk is showing.
 *
 * Switching it is what the sidebar switcher does; doing it here just saves
 * driving that dropdown before every deep link. Whatever it was when the run
 * started is restored at the end, so a capture leaves no trace on the account.
 */
async function readActiveLocation() {
  const user = await prisma.user.findUnique({
    where: { email: EMAIL },
    select: { id: true, activeLocationId: true },
  });
  if (!user) throw new Error(`no user ${EMAIL} — has the database been seeded?`);
  return user;
}

async function setActiveLocation(userId: string, locationId: string | null) {
  await prisma.user.update({
    where: { id: userId },
    data: { activeLocationId: locationId },
  });
}

/**
 * Onboarding redirects to the inbox for anyone who already has a location, so
 * the demo tenant can never see it. This provisions a throwaway tenant with no
 * location, in its own organization, and tears it down afterwards. The three
 * steps are captured without pressing "Start reviewing", so nothing is synced
 * and no model is called.
 *
 * The address is on-brand rather than obviously scaffolding, because step one
 * prints it: it belongs to the same invented business as the rest of the
 * corpus, and it exists only for the length of the run.
 */
const ONBOARDING_EMAIL = "sarah@cornertable.com";
const ONBOARDING_PASSWORD = "shots-only-throwaway";

async function createOnboardingTenant() {
  await destroyOnboardingTenant();
  const organization = await prisma.organization.create({
    data: { name: "Corner Table Bistro" },
  });
  await prisma.user.create({
    data: {
      email: ONBOARDING_EMAIL,
      name: "Sarah Okonkwo",
      passwordHash: await hash(ONBOARDING_PASSWORD, 10),
      organizationId: organization.id,
    },
  });
  return organization.id;
}

/** Cascades to the user, its sessions, and anything the flow managed to write. */
async function destroyOnboardingTenant() {
  const existing = await prisma.user.findUnique({
    where: { email: ONBOARDING_EMAIL },
    select: { organizationId: true },
  });
  if (existing) {
    await prisma.organization.delete({ where: { id: existing.organizationId } });
  }
}

// ─── Machinery — no need to touch below here ─────────────────────────────────

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i === -1 ? null : (args[i + 1] ?? "");
};
const only = flag("only");
const externalBase = flag("base");
const port = Number(flag("port") ?? DEFAULT_PORT);

/** Set by resolveServer() before any shot is arranged. */
let base = externalBase || `http://localhost:${port}`;

async function settle(page: Page, ms = 1200) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
}

function goto(path: string) {
  return async (page: Page) => {
    await page.goto(`${base}${path}`, { waitUntil: "domcontentloaded" });
    await settle(page);
  };
}

/**
 * Fill a controlled React input, after hydration.
 *
 * Typing before hydration silently loses the value: the field is controlled
 * from state that starts empty, so React's first client render writes that
 * empty string back over whatever was typed, and the form posts blank. Filling
 * again once the value sticks is the cheap way to be sure.
 */
async function fillHydrated(page: Page, selector: string, value: string) {
  for (let attempt = 0; attempt < 10; attempt++) {
    await page.fill(selector, value);
    await page.waitForTimeout(250);
    if ((await page.inputValue(selector)) === value) return;
  }
  throw new Error(`${selector} would not hold its value — is the page hydrating?`);
}

async function signIn(page: Page, email: string, password: string, wait: RegExp) {
  await page.goto(`${base}/signin`, { waitUntil: "networkidle" });
  await fillHydrated(page, "#email", email);
  await fillHydrated(page, "#password", password);
  // Named, not `button[type=submit]`: the Google form's button comes first in
  // the DOM and clicking it leaves for accounts.google.com.
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL(wait, { timeout: 90_000 });
  await settle(page);
}

/**
 * Whether a server is answering, and whether it is *this* app.
 *
 * A port convention is not enough of a guard: something else answering on the
 * port would be photographed without a single error. The sign-in headline is
 * only in this project, so it settles the question. /signin is fetched without
 * cookies, so it renders rather than redirecting.
 */
async function identify(url: string): Promise<"ours" | "stranger" | "down"> {
  try {
    const res = await fetch(`${url}/signin`, { redirect: "follow" });
    if (!res.ok) return "stranger";
    const html = await res.text();
    return html.includes("Answer every review in your own voice")
      ? "ours"
      : "stranger";
  } catch {
    return "down";
  }
}

async function waitForUs(url: string, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await identify(url)) === "ours") return true;
    await new Promise((r) => setTimeout(r, 700));
  }
  return false;
}

/**
 * Next 16 runs one dev server per project directory and refuses a second one,
 * so this cannot simply claim a private port: if the project is already up on
 * the port its author is using, that is the server to capture. Ports are only
 * candidates — every one of them has to identify as this app before a single
 * screenshot is taken.
 */
const CANDIDATE_PORTS = [DEFAULT_PORT, 3000, 3001, 3002];

async function resolveServer(): Promise<ChildProcess | null> {
  if (externalBase) {
    const who = await identify(externalBase);
    if (who !== "ours") {
      throw new Error(
        `${externalBase} ${who === "down" ? "is not answering" : "is not this app"} — ` +
          `nothing was captured.`,
      );
    }
    console.log(`capturing ${externalBase} (started elsewhere)`);
    return null;
  }

  for (const p of CANDIDATE_PORTS) {
    const url = `http://localhost:${p}`;
    if ((await identify(url)) === "ours") {
      base = url;
      console.log(`review-desk is already running on :${p} — capturing that`);
      return null;
    }
  }

  const taken = await identify(`http://localhost:${port}`);
  if (taken === "stranger") {
    throw new Error(
      `port ${port} is answering, but it is not this app. ` +
        `Pass --port <free port>, or --base <url> to capture a server you started yourself.`,
    );
  }

  base = `http://localhost:${port}`;
  console.log(`starting the dev server on :${port} …`);
  const proc = spawn("npm", devArgs(port), {
    stdio: "ignore",
    shell: true,
    env: { ...process.env },
  });
  if (!(await waitForUs(base, 120_000))) {
    stopDevServer(proc);
    throw new Error(
      `dev server never answered on ${base}. If one is already running for this ` +
        `project on another port, pass --base http://localhost:<that port>.`,
    );
  }
  return proc;
}

/** npm sits under a shell wrapper, so killing the pid leaves the server running. */
function stopDevServer(proc: ChildProcess | null) {
  if (!proc?.pid) return;
  if (process.platform === "win32") {
    // Synchronous: an async kill would not outlive the process.exit() below.
    spawnSync("taskkill", ["/pid", String(proc.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    proc.kill();
  }
}

function contactSheet(shots: Shot[]) {
  const cards = shots
    .map(
      (s, i) => `
      <figure>
        <a href="${s.slug}-${s.viewportOnly ? "viewport" : "full"}.png"><img src="${s.slug}-viewport.png" alt="${s.title}"></a>
        <figcaption>
          <span class="n">${String(i + 1).padStart(2, "0")}</span>
          <strong>${s.title}</strong>
          <p>${s.note}</p>
          <code>${s.slug}-viewport.png${s.viewportOnly ? "" : ` · ${s.slug}-full.png`}</code>
        </figcaption>
      </figure>`,
    )
    .join("");

  return `<!doctype html>
<html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${COPY.title}</title>
<style>
  :root { color-scheme: light; --ink:#1a1c1c; --dim:#5f6a68; --line:#e3e7e6; --accent:#1f6b5c; }
  * { box-sizing: border-box; }
  body { margin:0; padding:48px 40px 80px; background:#f7f8f8; color:var(--ink);
         font:15px/1.55 ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif; }
  header { max-width:760px; margin-bottom:40px; }
  h1 { font-size:30px; letter-spacing:-.01em; margin:0 0 10px; }
  header p { color:var(--dim); margin:0 0 6px; }
  .grid { display:grid; gap:28px; grid-template-columns:repeat(auto-fill,minmax(420px,1fr)); }
  figure { margin:0; background:#fff; border:1px solid var(--line); border-radius:10px; overflow:hidden; }
  figure img { display:block; width:100%; border-bottom:1px solid var(--line); }
  figcaption { padding:16px 18px 18px; }
  .n { font:500 12px/1 ui-monospace,SFMono-Regular,monospace; color:var(--accent); margin-right:8px; }
  figcaption strong { font-weight:600; }
  figcaption p { color:var(--dim); font-size:13.5px; margin:8px 0 10px; }
  figcaption code { font:11.5px/1.4 ui-monospace,SFMono-Regular,monospace; color:#8a9793; word-break:break-all; }
</style></head>
<body>
  <header>
    <h1>${COPY.title}</h1>
    <p>${COPY.lede(VIEWPORT.width, VIEWPORT.height)}</p>
    <p>${COPY.footnote}</p>
  </header>
  <div class="grid">${cards}</div>
</body></html>`;
}

async function main() {
  const ids = await pickIds();
  const all = buildShots(ids);
  const shots = only ? all.filter((s) => s.slug.includes(only)) : all;
  if (!shots.length) throw new Error(`no shot matches --only ${only}`);

  const dev = await resolveServer();

  // A partial run tops up an existing capture set; a full run replaces it.
  if (!only) await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const contextOptions = {
    viewport: VIEWPORT,
    deviceScaleFactor: SCALE,
    colorScheme: "light" as const,
    // Scroll-reveal sections would otherwise be photographed at opacity 0 in a
    // full-page capture, which never scrolls. Reduced motion also lands every
    // entrance animation on its final frame, so no shot catches a half-fade.
    reducedMotion: "reduce" as const,
  };

  const desk = await browser.newContext(contextOptions);
  let onboarding: Awaited<ReturnType<typeof browser.newContext>> | null = null;
  let anon: Awaited<ReturnType<typeof browser.newContext>> | null = null;
  const wantsOnboarding = shots.some((s) => s.context === "onboarding");

  const operator = await readActiveLocation();
  let active = operator.activeLocationId;

  try {
    // Signed in once per context: the cookie lives on the context, so every
    // page opened from it is already authenticated.
    const warmup = await desk.newPage();
    await signIn(warmup, EMAIL, PASSWORD, /\/inbox/);
    await warmup.close();

    if (wantsOnboarding) {
      await createOnboardingTenant();
      onboarding = await browser.newContext(contextOptions);
      const page = await onboarding.newPage();
      await signIn(page, ONBOARDING_EMAIL, ONBOARDING_PASSWORD, /\/onboarding/);
      await page.close();
    }

    for (const shot of shots) {
      // Shots that don't name a location get the operator's own, so a switch
      // made for one deep link doesn't leak into the screens after it — the
      // sidebar, the activity log and the settings all read from it too.
      const wantLocation = shot.locationId ?? operator.activeLocationId;
      if (wantLocation !== active) {
        await setActiveLocation(operator.id, wantLocation);
        active = wantLocation;
      }

      if (shot.context === "anon" && !anon) {
        anon = await browser.newContext(contextOptions);
      }
      const context =
        shot.context === "onboarding" ? onboarding! : shot.context === "anon" ? anon! : desk;
      const page = await context.newPage();
      await shot.arrange(page);
      await page.addStyleTag({
        content: `${HIDE.join(",")} { display: none !important }`,
      });
      await page.screenshot({ path: join(OUT, `${shot.slug}-viewport.png`) });
      if (!shot.viewportOnly) {
        await page.screenshot({
          path: join(OUT, `${shot.slug}-full.png`),
          fullPage: true,
        });
      }
      await page.close();
      console.log(`  ${shot.slug}`);
    }

    await writeFile(join(OUT, "index.html"), contactSheet(all), "utf8");
  } finally {
    await browser.close();
    if (active !== operator.activeLocationId) {
      await setActiveLocation(operator.id, operator.activeLocationId).catch(() => {});
    }
    if (wantsOnboarding) await destroyOnboardingTenant().catch(() => {});
    await prisma.$disconnect();
    stopDevServer(dev);
  }

  console.log(`\n${shots.length} shots in shots/ — open shots/index.html to pick.`);
  process.exit(0); // a dev server's children can outlive a plain kill()
}

main().catch(async (err) => {
  console.error(err);
  await destroyOnboardingTenant().catch(() => {});
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
