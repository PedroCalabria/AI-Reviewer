import "dotenv/config";
import { chromium, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import { prisma } from "../lib/db";

/**
 * Regenerates the README screenshots.
 *
 * Playwright is not a dependency of this project — it is only needed to rebuild
 * the images in docs/screenshots, so install it on demand rather than making
 * every clone download a browser:
 *
 *   npm run dev                            # in one terminal
 *   npm install --no-save playwright
 *   npx playwright install chromium
 *   npx tsx scripts/screenshots.mts
 */

const BASE = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3000";
const OUT = "docs/screenshots";
const EMAIL = "demo@cornertable.com";
const PASSWORD = "reviewdesk2026";

async function signIn(page: Page) {
  await page.goto(`${BASE}/signin`, { waitUntil: "networkidle" });
  await page.fill("#email", EMAIL);
  await page.fill("#password", PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/inbox/, { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
}

/** A review on each lane, so the shots show the real thing rather than a mock. */
async function pickReviews() {
  const generated = await prisma.review.findFirst({
    where: {
      route: "GENERATE",
      status: "NEEDS_REVIEW",
      guardrailEvents: { some: { outcome: "REPAIRED" } },
    },
    select: { id: true },
  });

  const anyGenerated =
    generated ??
    (await prisma.review.findFirst({
      where: { route: "GENERATE", status: "NEEDS_REVIEW" },
      select: { id: true },
    }));

  const escalated = await prisma.review.findFirst({
    where: { route: "ESCALATE" },
    orderBy: { postedAt: "desc" },
    select: { id: true },
  });

  return { generated: anyGenerated?.id, escalated: escalated?.id };
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    deviceScaleFactor: 2,
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  await signIn(page);

  const { generated, escalated } = await pickReviews();

  const shots: Array<[string, string]> = [
    ["inbox", `${BASE}/inbox`],
    ["activity", `${BASE}/activity`],
    ["settings", `${BASE}/settings`],
  ];
  if (generated) shots.push(["review-generated", `${BASE}/inbox/${generated}`]);
  if (escalated) shots.push(["review-escalated", `${BASE}/inbox/${escalated}`]);

  for (const [name, url] of shots) {
    await page.goto(url, { waitUntil: "networkidle" });
    // The dev-tools indicator floats over the bottom-left of the sidebar.
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/${name}.png` });
    console.log(`${OUT}/${name}.png`);
  }

  await browser.close();
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
