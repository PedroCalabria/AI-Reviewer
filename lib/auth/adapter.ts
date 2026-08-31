import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { prisma } from "@/lib/db";

/**
 * The Prisma adapter, wrapped so that a user can never exist without an
 * organization.
 *
 * Every query in this app is scoped by organization ID taken from the session.
 * That only holds if the ID is always there, which means provisioning the
 * organization in the same transaction that creates the user rather than in a
 * follow-up hook that might not run. The stock adapter's `createUser` does a
 * bare insert and would fail on the required foreign key, so it is replaced.
 *
 * Locations are not created here. A new user picks one during onboarding, from
 * whatever the configured provider reports.
 */
export function reviewDeskAdapter(): Adapter {
  const base = PrismaAdapter(prisma) as Adapter;

  return {
    ...base,

    async createUser(user) {
      const email = user.email ?? "";
      const organizationName =
        user.name?.trim() || email.split("@")[0] || "My business";

      const created = await prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({
          data: {
            name: organizationName,
            brandVoice: { create: {} },
          },
        });

        return tx.user.create({
          data: {
            name: user.name,
            email,
            emailVerified: user.emailVerified ?? null,
            image: user.image,
            organizationId: organization.id,
          },
        });
      });

      return {
        id: created.id,
        name: created.name,
        email: created.email,
        emailVerified: created.emailVerified,
        image: created.image,
      } satisfies AdapterUser;
    },
  };
}
