import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { compare } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { reviewDeskAdapter } from "./adapter";
import {
  clearAttempts,
  isRateLimited,
  recordFailedAttempt,
  retryAfterMinutes,
} from "./rate-limit";

/**
 * Two ways in, one session model.
 *
 * Google OAuth is real and works today with basic scopes. Credentials exist so
 * the app can be reviewed without a Google account at all — see the demo login
 * in the README.
 */

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(8, "Passwords are at least 8 characters."),
});

/** Auth.js surfaces `code` to the sign-in page; the message never reaches it. */
class InvalidCredentials extends CredentialsSignin {
  code = "credentials";
}

class TooManyAttempts extends CredentialsSignin {
  code = "throttled";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: reviewDeskAdapter(),

  // The Credentials provider requires JWT sessions in Auth.js v5: there is no
  // adapter round-trip on a credentials sign-in for a database session to hang
  // off. The adapter still backs the Google flow and owns the user records.
  session: { strategy: "jwt" },

  pages: {
    signIn: "/signin",
  },

  providers: [
    Google({
      authorization: {
        params: {
          // Basic scopes only. Reading and replying to reviews needs
          //   https://www.googleapis.com/auth/business.manage
          // which is a restricted scope: it requires an approved Business
          // Profile API access request and Google OAuth verification, neither
          // of which this project has. It is left here, commented, because
          // turning it on is the first step of the migration described in the
          // README — not something to discover later.
          //
          // scope: "openid email profile https://www.googleapis.com/auth/business.manage",
          scope: "openid email profile",
          prompt: "consent",
          access_type: "offline",
        },
      },
      allowDangerousEmailAccountLinking: true,
    }),

    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },

      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) throw new InvalidCredentials();

        const { email, password } = parsed.data;

        if (isRateLimited(email)) {
          throw new TooManyAttempts(
            `Too many attempts. Try again in ${retryAfterMinutes(email)} minutes.`,
          );
        }

        const user = await prisma.user.findUnique({ where: { email } });

        // Compare against a dummy hash when there is no user, so a missing
        // account and a wrong password take the same time to answer.
        const hash =
          user?.passwordHash ??
          "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.z0Q9Ux0KXjKMJvJ2rTLxHhPWa8Yy";

        const ok = await compare(password, hash);

        if (!ok || !user?.passwordHash) {
          recordFailedAttempt(email);
          throw new InvalidCredentials();
        }

        clearAttempts(email);

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
        };
      },
    }),
  ],

  callbacks: {
    /**
     * The tenancy claims ride on the token, so scoping a query never needs a
     * database round-trip and never reads an organization ID off a request.
     * They are re-read from the database when the session is updated, which is
     * what makes the onboarding location choice show up without a re-login.
     */
    async jwt({ token, user, trigger }) {
      if (user?.id) token.userId = user.id;

      const shouldRefresh =
        !token.organizationId || trigger === "update" || Boolean(user);

      if (shouldRefresh && token.userId) {
        const record = await prisma.user.findUnique({
          where: { id: token.userId as string },
          select: {
            organizationId: true,
            activeLocationId: true,
            name: true,
            organization: { select: { name: true } },
          },
        });

        if (record) {
          token.organizationId = record.organizationId;
          token.activeLocationId = record.activeLocationId ?? null;
          token.businessName = record.organization.name;
          token.name = record.name ?? token.name;
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.user.id = token.userId as string;
      session.user.organizationId = token.organizationId as string;
      session.user.activeLocationId =
        (token.activeLocationId as string | null) ?? null;
      session.user.businessName = (token.businessName as string) ?? "";
      return session;
    },
  },
});
