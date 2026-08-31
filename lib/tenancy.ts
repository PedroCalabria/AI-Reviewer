import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/**
 * The one place an organization ID enters the application.
 *
 * Every query is scoped by the ID this returns, which comes from the session
 * and never from a route parameter, a form field, or a header. That is the
 * whole of the multi-tenancy story, and keeping it to one helper is what makes
 * it reviewable: if a query is scoped, it got its scope from here.
 */

export type Tenant = {
  userId: string;
  userName: string;
  userEmail: string;
  organizationId: string;
  businessName: string;
  /** Null until the user picks a location during onboarding. */
  activeLocationId: string | null;
};

/** The tenant for the current request, or null when nobody is signed in. */
export async function currentTenant(): Promise<Tenant | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.organizationId) return null;

  return {
    userId: session.user.id,
    userName: session.user.name ?? "",
    userEmail: session.user.email ?? "",
    organizationId: session.user.organizationId,
    businessName: session.user.businessName,
    activeLocationId: session.user.activeLocationId,
  };
}

/** For pages behind the desk: sends anonymous visitors to sign in. */
export async function requireTenant(): Promise<Tenant> {
  const tenant = await currentTenant();
  if (!tenant) redirect("/signin");
  return tenant;
}

/**
 * For pages that also need a location, which is everything in the desk. A
 * signed-in user with no location has not finished onboarding.
 */
export async function requireLocation(): Promise<
  Tenant & { activeLocationId: string }
> {
  const tenant = await requireTenant();

  // Read the active location from the database rather than the session.
  //
  // The organization ID is immutable and can safely ride on the JWT, but the
  // active location changes whenever the user picks another one from the
  // sidebar. A JWT is only re-issued on sign-in, so trusting the token here
  // would write the new choice to the database and then carry on serving the
  // old location until the user signed out and back in.
  const user = await prisma.user.findUnique({
    where: { id: tenant.userId },
    select: {
      activeLocation: {
        select: { id: true, organizationId: true },
      },
    },
  });

  const active = user?.activeLocation;
  if (active && active.organizationId === tenant.organizationId) {
    return { ...tenant, activeLocationId: active.id };
  }

  // Fall back to any location this organization owns before sending the user
  // back through onboarding for a claim that is merely stale.
  const fallback = await prisma.location.findFirst({
    where: { organizationId: tenant.organizationId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  if (!fallback) redirect("/onboarding");

  await prisma.user.update({
    where: { id: tenant.userId },
    data: { activeLocationId: fallback.id },
  });

  return { ...tenant, activeLocationId: fallback.id };
}

/**
 * For server actions: throws rather than redirecting, so a failed action
 * surfaces as an error the caller handles instead of a redirect mid-mutation.
 */
export async function requireTenantForAction(): Promise<Tenant> {
  const tenant = await currentTenant();
  if (!tenant) throw new Error("You are signed out. Sign in and try again.");
  return tenant;
}

/**
 * The location the user is actually working, read fresh.
 *
 * Actions must not take this from the session for the same reason
 * requireLocation does not: the sidebar switcher changes it mid-session and the
 * token would not know.
 */
export async function activeLocationIdForAction(
  tenant: Tenant,
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: tenant.userId },
    select: { activeLocation: { select: { id: true, organizationId: true } } },
  });

  const active = user?.activeLocation;
  return active && active.organizationId === tenant.organizationId
    ? active.id
    : null;
}

/**
 * Confirms a review belongs to the caller's organization before anything is
 * done to it. Every action that takes a review ID from the client calls this
 * first — the ID is user input until this has run.
 */
export async function assertOwnsReview(
  organizationId: string,
  reviewId: string,
): Promise<{ id: string; locationId: string }> {
  const review = await prisma.review.findFirst({
    where: { id: reviewId, location: { organizationId } },
    select: { id: true, locationId: true },
  });

  if (!review) throw new Error("That review is not in your queue.");
  return review;
}
