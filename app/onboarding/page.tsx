import { redirect } from "next/navigation";
import { OnboardingFlow } from "@/components/app/OnboardingFlow";
import { prisma } from "@/lib/db";
import { getReviewProvider } from "@/lib/providers";
import { requireTenant } from "@/lib/tenancy";

export default async function OnboardingPage() {
  const tenant = await requireTenant();

  // Somebody who has already been through this goes straight to the queue.
  const existing = await prisma.location.findFirst({
    where: { organizationId: tenant.organizationId },
    select: { id: true },
  });
  if (existing) redirect("/inbox");

  const [locations, brandVoice, user] = await Promise.all([
    getReviewProvider().listLocations(),
    prisma.brandVoice.findUnique({
      where: { organizationId: tenant.organizationId },
    }),
    prisma.user.findUnique({
      where: { id: tenant.userId },
      include: { accounts: { select: { provider: true } } },
    }),
  ]);

  return (
    <OnboardingFlow
      account={{
        name: user?.name ?? tenant.userName,
        email: user?.email ?? tenant.userEmail,
        method: user?.accounts.some((a) => a.provider === "google")
          ? "Google"
          : "Email and password",
      }}
      businessName={tenant.businessName}
      locations={locations}
      initialTone={brandVoice?.tone ?? "Warm"}
      initialAlwaysMention={brandVoice?.alwaysMention ?? ""}
      initialContactEmail={brandVoice?.contactEmail ?? ""}
    />
  );
}
