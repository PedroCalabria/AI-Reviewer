"use server";

import { revalidatePath } from "next/cache";
import { isToneName } from "@/lib/constants";
import { prisma } from "@/lib/db";
import { getReviewProvider } from "@/lib/providers";
import { enqueueSync, drainQueue } from "@/lib/sync/runSync";
import { requireTenantForAction } from "@/lib/tenancy";

/**
 * Onboarding.
 *
 * Locations are created here rather than at sign-up, because they come from
 * whatever the configured provider reports and the owner has to pick one. With
 * the synthetic provider that is the fixture list; with the real one it will be
 * whatever their Google account manages, and this code does not change.
 */

export type ProviderLocationOption = {
  externalId: string;
  name: string;
  address: string;
};

export async function listAvailableLocations(): Promise<
  ProviderLocationOption[]
> {
  await requireTenantForAction();
  const provider = getReviewProvider();
  return provider.listLocations();
}

export async function completeOnboarding(input: {
  locationExternalId: string;
  tone: string;
  alwaysMention: string;
  contactEmail: string;
  businessName?: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const tenant = await requireTenantForAction();

  const available = await getReviewProvider().listLocations();
  const chosen = available.find(
    (l) => l.externalId === input.locationExternalId,
  );
  if (!chosen) return { ok: false, error: "Pick a location to continue." };

  const tone = isToneName(input.tone) ? input.tone : "Warm";

  const location = await prisma.$transaction(async (tx) => {
    if (input.businessName?.trim()) {
      await tx.organization.update({
        where: { id: tenant.organizationId },
        data: { name: input.businessName.trim() },
      });
    }

    await tx.brandVoice.upsert({
      where: { organizationId: tenant.organizationId },
      create: {
        organizationId: tenant.organizationId,
        tone,
        alwaysMention: input.alwaysMention.trim(),
        contactEmail: input.contactEmail.trim(),
      },
      update: {
        tone,
        alwaysMention: input.alwaysMention.trim(),
        contactEmail: input.contactEmail.trim(),
      },
    });

    // Every location the provider reports is created, so the sidebar switcher
    // has something to switch between; the chosen one becomes active.
    let active = null as { id: string } | null;
    for (const candidate of available) {
      const row = await tx.location.upsert({
        where: {
          organizationId_externalId: {
            organizationId: tenant.organizationId,
            externalId: candidate.externalId,
          },
        },
        create: {
          organizationId: tenant.organizationId,
          externalId: candidate.externalId,
          name: candidate.name,
          address: candidate.address,
        },
        update: { name: candidate.name, address: candidate.address },
      });
      if (candidate.externalId === chosen.externalId) active = row;
    }

    if (active) {
      await tx.user.update({
        where: { id: tenant.userId },
        data: { activeLocationId: active.id },
      });
    }

    return active;
  });

  if (!location) return { ok: false, error: "Could not set up that location." };

  // First sync runs inline so the inbox is not empty when they arrive. It is
  // the ordinary sync path — the same one the button and the schedule use.
  await enqueueSync(location.id, "manual");
  await drainQueue(location.id);

  revalidatePath("/inbox");
  return { ok: true };
}
