import type { DefaultSession } from "next-auth";

/**
 * The tenancy claims carried on the session and the JWT.
 *
 * `organizationId` being non-optional here is what lets the scoping helper in
 * lib/tenancy.ts treat its absence as a bug rather than a case to handle.
 */
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      organizationId: string;
      activeLocationId: string | null;
      businessName: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    organizationId?: string;
    activeLocationId?: string | null;
    businessName?: string;
  }
}

export {};
