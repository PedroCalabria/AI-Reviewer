"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { credentialsSchema, signIn, signOut } from "@/lib/auth";

/**
 * Sign-in and sign-out, kept out of lib/actions.ts because those all begin by
 * resolving a session and these are what create one.
 */

export type SignInState = { error?: string };

export async function signInWithPassword(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check those details." };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/inbox",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      // The same message whether the account is missing or the password is
      // wrong: telling them apart tells an attacker which emails exist.
      return {
        error:
          error.cause &&
          typeof error.cause === "object" &&
          "err" in error.cause &&
          String((error.cause as { err?: unknown }).err).includes("throttled")
            ? "Too many attempts. Wait a few minutes and try again."
            : "That email and password don't match an account.",
      };
    }
    // A successful sign-in redirects by throwing, so anything else is rethrown.
    throw error;
  }

  return {};
}

export async function signInWithGoogle(): Promise<void> {
  await signIn("google", { redirectTo: "/onboarding" });
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirect: false });
  redirect("/signin");
}
