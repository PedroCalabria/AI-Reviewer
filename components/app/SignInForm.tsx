"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ds/Button";
import { Input } from "@/components/ds/Input";
import {
  signInWithGoogle,
  signInWithPassword,
  type SignInState,
} from "@/lib/auth-actions";

/**
 * Two ways in.
 *
 * Google is the headline because that is how a real owner would connect their
 * profile. Email and password is below it because it is how this project is
 * reviewed — see the demo credentials in the README. There is no self-service
 * registration: accounts come from the seed.
 */
export function SignInForm({ googleConfigured }: { googleConfigured: boolean }) {
  const [state, formAction] = useActionState<SignInState, FormData>(
    signInWithPassword,
    {},
  );

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <div>
      {googleConfigured ? (
        <form action={signInWithGoogle}>
          <Button variant="primary" size="lg" fullWidth type="submit">
            Continue with Google
          </Button>
        </form>
      ) : (
        <div
          style={{
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-card)",
            padding: "var(--space-5) var(--space-6)",
            font: "var(--type-body-sm)",
            color: "var(--text-muted)",
          }}
        >
          Google sign-in is available once{" "}
          <code style={{ font: "var(--type-meta)" }}>AUTH_GOOGLE_ID</code> and{" "}
          <code style={{ font: "var(--type-meta)" }}>AUTH_GOOGLE_SECRET</code>{" "}
          are set. Sign in with an email and password below.
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
          margin: "var(--space-8) 0",
        }}
      >
        <span style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
        <span style={{ font: "var(--type-meta)", color: "var(--text-faint)" }}>
          or
        </span>
        <span style={{ flex: 1, height: 1, background: "var(--border-subtle)" }} />
      </div>

      <form action={formAction} style={{ display: "grid", gap: "var(--space-4)" }}>
        <label style={{ display: "block" }}>
          <span
            style={{
              display: "block",
              font: "var(--type-label)",
              letterSpacing: "var(--tracking-snug)",
              marginBottom: "var(--space-3)",
            }}
          >
            Email
          </span>
          <Input
            icon="mail"
            type="email"
            name="email"
            id="email"
            placeholder="you@yourbusiness.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label style={{ display: "block" }}>
          <span
            style={{
              display: "block",
              font: "var(--type-label)",
              letterSpacing: "var(--tracking-snug)",
              marginBottom: "var(--space-3)",
            }}
          >
            Password
          </span>
          <Input
            type="password"
            name="password"
            id="password"
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>

        {state.error ? (
          <div
            role="alert"
            style={{
              font: "var(--type-body-sm)",
              color: "var(--text-primary)",
              background: "var(--surface-subtle)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-4) var(--space-5)",
            }}
          >
            {state.error}
          </div>
        ) : null}

        <SubmitButton />
      </form>

      <div
        style={{
          height: 1,
          background: "var(--border-subtle)",
          margin: "var(--space-8) 0 var(--space-6)",
        }}
      />
      <p
        style={{
          margin: 0,
          font: "var(--type-body-sm)",
          color: "var(--text-muted)",
        }}
      >
        Signing in with Google requests your name and email only. Reading and
        replying to Business Profile reviews needs API access we don&rsquo;t
        have yet, so the reviews in here are synthetic — the README explains
        why, and what changes when that access arrives.
      </p>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button variant="outline" size="lg" fullWidth type="submit" disabled={pending}>
      {pending ? "Signing in" : "Sign in"}
    </Button>
  );
}
