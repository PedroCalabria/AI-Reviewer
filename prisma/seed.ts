import "dotenv/config";
import { hash } from "bcryptjs";
import { isAiConfigured } from "../lib/ai/gemini";
import { prisma } from "../lib/db";
import { FIXTURE_LOCATIONS } from "../lib/providers";
import { syncNow } from "../lib/sync/runSync";

/**
 * The seed.
 *
 * It provisions a tenant and then ingests the synthetic corpus through the
 * ordinary sync path — the same enqueue, fetch, upsert, triage, and log that
 * the `Sync now` button runs. Nothing here writes a review, a draft, or a
 * guardrail event directly. If the seed produces a good-looking inbox, that is
 * evidence the pipeline works, which a hand-written fixture set would not be.
 *
 * Re-running it is safe: the tenant is upserted and the sync is idempotent.
 */

const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "demo@cornertable.com";

/**
 * The demo password.
 *
 * The default is written in the README so a reviewer can sign in immediately,
 * which is exactly why it must not be the password on a deployment anyone can
 * reach. Set DEMO_PASSWORD when seeding anything public.
 */
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "reviewdesk2026";

const DEMO_NAME = "Sarah Okonkwo";
const BUSINESS_NAME = "Corner Table Bistro";

async function main() {
  console.log("Seeding Review Desk\n");

  // --- The tenant ----------------------------------------------------------
  const existing = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    select: { organizationId: true },
  });

  const organization = existing
    ? await prisma.organization.update({
        where: { id: existing.organizationId },
        data: { name: BUSINESS_NAME },
      })
    : await prisma.organization.create({ data: { name: BUSINESS_NAME } });

  await prisma.brandVoice.upsert({
    where: { organizationId: organization.id },
    create: {
      organizationId: organization.id,
      tone: "Warm",
      alwaysMention: "",
      contactEmail: "hello@cornertable.com",
    },
    update: {},
  });

  const passwordHash = await hash(DEMO_PASSWORD, 10);

  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    create: {
      email: DEMO_EMAIL,
      name: DEMO_NAME,
      passwordHash,
      organizationId: organization.id,
    },
    update: { passwordHash, name: DEMO_NAME },
  });

  console.log(`  Organization  ${organization.name}`);
  // Only echo the password when it is the public default. A password supplied
  // for a real deployment should not end up in a build log or a screenshot.
  console.log(
    `  Demo account  ${DEMO_EMAIL} / ${
      process.env.DEMO_PASSWORD ? "(set from DEMO_PASSWORD)" : DEMO_PASSWORD
    }`,
  );

  // --- Locations -----------------------------------------------------------
  // In the app these are created during onboarding from whatever the provider
  // reports. The seed does the same thing ahead of time so the demo account
  // lands straight in the inbox.
  const locations = [];
  for (const fixture of FIXTURE_LOCATIONS) {
    locations.push(
      await prisma.location.upsert({
        where: {
          organizationId_externalId: {
            organizationId: organization.id,
            externalId: fixture.externalId,
          },
        },
        create: {
          organizationId: organization.id,
          externalId: fixture.externalId,
          name: fixture.name,
          address: fixture.address,
        },
        update: { name: fixture.name, address: fixture.address },
      }),
    );
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { activeLocationId: locations[0].id },
  });

  console.log(`  Locations     ${locations.map((l) => l.name).join(", ")}\n`);

  // --- Ingest through the real sync path -----------------------------------
  if (!isAiConfigured()) {
    console.log(
      "  No GOOGLE_GENERATIVE_AI_API_KEY set.\n" +
        "  Keyword escalations and template replies will still run — they cost nothing.\n" +
        "  Reviews that need a written reply will be ingested without a draft, and the\n" +
        "  inbox will say so rather than showing invented text. Add a key and re-run\n" +
        "  this to fill them in.\n",
    );
  } else {
    console.log(
      "  Running triage. Calls are serialized and rate-limited, so 50 reviews\n" +
        "  takes a few minutes on the free tier.\n",
    );
  }

  for (const location of locations) {
    const result = await syncNow(location.id, "manual");
    console.log(
      `  ${location.name}\n` +
        `    fetched ${result.reviewsFetched}, new ${result.reviewsCreated}\n` +
        `    escalated ${result.escalated} · templated ${result.templated} · ` +
        `drafted ${result.generated} · no draft ${result.failed}` +
        (result.error ? `\n    error: ${result.error}` : ""),
    );
  }

  const totals = await prisma.review.groupBy({
    by: ["route"],
    where: { location: { organizationId: organization.id } },
    _count: true,
  });

  console.log("\n  Queue by route");
  for (const row of totals) {
    console.log(`    ${row.route ?? "untriaged"}: ${row._count}`);
  }

  console.log(`\nDone. Sign in at /signin with ${DEMO_EMAIL}\n`);
}

main()
  .catch((error) => {
    console.error("\nSeed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
