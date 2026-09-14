"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import { Input } from "@/components/ds/Input";
import { ToneCards } from "@/components/app/ToneCards";
import { toneFor } from "@/lib/config/voice";
import { isToneName, type ToneName } from "@/lib/constants";
import { GUARDRAILS } from "@/lib/data";
import { completeOnboarding } from "@/lib/onboarding-actions";
import { initialsOf } from "@/lib/format";

const TOTAL_STEPS = 3;

type LocationOption = { externalId: string; name: string; address: string };

export function OnboardingFlow({
  account,
  businessName,
  locations,
  initialTone,
  initialAlwaysMention,
  initialContactEmail,
}: {
  account: { name: string; email: string; method: string };
  businessName: string;
  locations: LocationOption[];
  initialTone: string;
  initialAlwaysMention: string;
  initialContactEmail: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [step, setStep] = useState(1);
  const [tone, setTone] = useState<ToneName>(
    isToneName(initialTone) ? initialTone : "Warm",
  );
  const [alwaysMention, setAlwaysMention] = useState(initialAlwaysMention);
  const [contactEmail, setContactEmail] = useState(initialContactEmail);
  const [locationId, setLocationId] = useState(
    locations[0]?.externalId ?? "",
  );
  const [error, setError] = useState<string | null>(null);

  const selectedTone = toneFor(tone);

  const finish = () => {
    setError(null);
    startTransition(async () => {
      const result = await completeOnboarding({
        locationExternalId: locationId,
        tone,
        alwaysMention,
        contactEmail,
      });
      if (result.ok) router.push("/inbox");
      else setError(result.error);
    });
  };

  return (
    <div
      style={{
        flex: 1,
        width: "100%",
        maxWidth: 760,
        margin: "0 auto",
        padding: "var(--space-12) var(--container-gutter) var(--section-y)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-6)",
          marginBottom: "var(--space-12)",
        }}
      >
        <span
          style={{
            font: "var(--type-label)",
            letterSpacing: "var(--tracking-snug)",
            whiteSpace: "nowrap",
          }}
        >
          Step {step} of {TOTAL_STEPS}
        </span>
        <span style={{ flex: 1, display: "flex", gap: "var(--space-1)" }}>
          {[1, 2, 3].map((n) => (
            <span
              key={n}
              style={{
                height: 2,
                flex: 1,
                background:
                  step >= n ? "var(--ink-1000)" : "var(--border-subtle)",
              }}
            />
          ))}
        </span>
      </div>

      {step === 1 ? (
        <div>
          <h2
            style={{
              margin: "0 0 var(--space-4)",
              font: "var(--type-section-title)",
              fontSize: "clamp(26px, 3.4vw, var(--size-h2))",
              letterSpacing: "var(--tracking-tight)",
            }}
          >
            You&rsquo;re signed in
          </h2>
          <p
            style={{
              margin: "0 0 var(--space-10)",
              font: "var(--type-body)",
              color: "var(--text-muted)",
              maxWidth: "44em",
            }}
          >
            Next we&rsquo;ll pick a location and set the voice your replies are
            written in. You can change both later, and you can sign out at any
            time.
          </p>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-4)",
              flexWrap: "wrap",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-card)",
              padding: "var(--space-5) var(--space-6)",
              marginBottom: "var(--space-8)",
            }}
          >
            <span
              style={{
                flex: "none",
                width: 44,
                height: 44,
                borderRadius: "var(--radius-circle)",
                background: "var(--surface-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                font: "var(--type-label)",
              }}
            >
              {initialsOf(account.name, account.email)}
            </span>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  font: "var(--type-post-title)",
                  letterSpacing: "var(--tracking-snug)",
                }}
              >
                {account.name || businessName}
              </div>
              <div
                style={{
                  marginTop: 4,
                  font: "var(--type-meta)",
                  color: "var(--text-muted)",
                }}
              >
                {account.email} · {account.method}
              </div>
            </div>
            <div style={{ marginLeft: "auto" }}>
              <Badge variant="dark" size="sm">
                Signed in
              </Badge>
            </div>
          </div>

          {/* Said plainly here rather than discovered later in an empty inbox. */}
          <div
            style={{
              background: "var(--surface-subtle)",
              borderRadius: "var(--radius-card)",
              padding: "var(--space-5) var(--space-6)",
              marginBottom: "var(--space-10)",
              font: "var(--type-body-sm)",
              color: "var(--text-muted)",
              maxWidth: "52em",
            }}
          >
            The reviews you&rsquo;re about to see are synthetic. Reading real
            ones needs Google Business Profile API access, which has to be
            applied for against a verified profile — so this runs on a stand-in
            provider until that lands. Everything else here is real.
          </div>

          <Button variant="primary" size="md" onClick={() => setStep(2)}>
            Continue
          </Button>
        </div>
      ) : null}

      {step === 2 ? (
        <div>
          <h2
            style={{
              margin: "0 0 var(--space-4)",
              font: "var(--type-section-title)",
              fontSize: "clamp(26px, 3.4vw, var(--size-h2))",
              letterSpacing: "var(--tracking-tight)",
            }}
          >
            Choose a location
          </h2>
          <p
            style={{
              margin: "0 0 var(--space-10)",
              font: "var(--type-body)",
              color: "var(--text-muted)",
              maxWidth: "44em",
            }}
          >
            {locations.length > 1
              ? "This account manages more than one. Pick the one you want to start with — you can switch from the sidebar whenever you like."
              : "This is the location on the account."}
          </p>

          <div
            role="radiogroup"
            aria-label="Location"
            style={{
              borderTop: "1px solid var(--border-subtle)",
              marginBottom: "var(--space-10)",
            }}
          >
            {locations.map((location) => {
              const on = locationId === location.externalId;
              return (
                <button
                  key={location.externalId}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setLocationId(location.externalId)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-4)",
                    flexWrap: "wrap",
                    width: "100%",
                    background: "transparent",
                    border: 0,
                    borderBottom: "1px solid var(--border-subtle)",
                    padding: "var(--space-6) 0",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span
                    style={{
                      flex: "none",
                      width: 16,
                      height: 16,
                      borderRadius: "var(--radius-circle)",
                      border: `1px solid ${on ? "var(--ink-1000)" : "var(--border-strong)"}`,
                      background: on ? "var(--ink-1000)" : "transparent",
                      boxShadow: on ? "inset 0 0 0 3px var(--ink-000)" : "none",
                    }}
                  />
                  <span
                    style={{ minWidth: 0, textAlign: "left", flex: "1 1 220px" }}
                  >
                    <span
                      style={{
                        display: "block",
                        font: "var(--type-post-title)",
                        letterSpacing: "var(--tracking-snug)",
                      }}
                    >
                      {location.name}
                    </span>
                    <span
                      style={{
                        display: "block",
                        marginTop: 4,
                        font: "var(--type-meta)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {location.address}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              flexWrap: "wrap",
            }}
          >
            <Button
              variant="primary"
              size="md"
              onClick={() => setStep(3)}
              disabled={!locationId}
            >
              Continue
            </Button>
            <Button variant="ghost" size="md" onClick={() => setStep(1)}>
              Back
            </Button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div>
          <h2
            style={{
              margin: "0 0 var(--space-4)",
              font: "var(--type-section-title)",
              fontSize: "clamp(26px, 3.4vw, var(--size-h2))",
              letterSpacing: "var(--tracking-tight)",
            }}
          >
            Set your brand voice
          </h2>
          <p
            style={{
              margin: "0 0 var(--space-8)",
              font: "var(--type-body)",
              color: "var(--text-muted)",
              maxWidth: "44em",
            }}
          >
            Every draft is written this way. You can change it whenever you like.
          </p>

          <ToneCards selected={tone} onSelect={setTone} />

          <div
            style={{
              marginTop: "var(--space-8)",
              border: "1px solid var(--border-subtle)",
              borderRadius: "var(--radius-card)",
              padding: "var(--space-6)",
            }}
          >
            <div
              style={{
                font: "var(--type-label)",
                color: "var(--text-muted)",
                letterSpacing: "var(--tracking-snug)",
              }}
            >
              Example reply · {selectedTone.name} voice · four stars
            </div>
            <div
              style={{ marginTop: "var(--space-4)", font: "var(--type-body)" }}
            >
              {selectedTone.example}
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gap: "var(--space-6)",
              margin: "var(--space-10) 0",
            }}
          >
            <label style={{ display: "block" }}>
              <span
                style={{
                  display: "block",
                  font: "var(--type-label)",
                  letterSpacing: "var(--tracking-snug)",
                  marginBottom: "var(--space-3)",
                }}
              >
                Anything we should always mention?
              </span>
              <Input
                placeholder="Our email for follow-ups, or that we are family-owned since 1998"
                value={alwaysMention}
                onChange={(e) => setAlwaysMention(e.target.value)}
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
                Where should we send unhappy customers?
              </span>
              <Input
                icon="mail"
                type="email"
                placeholder="hello@yourbusiness.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </label>
          </div>

          <div
            style={{
              background: "var(--surface-inverse)",
              borderRadius: "var(--radius-band)",
              padding: "var(--space-10) var(--space-10) var(--space-12)",
            }}
          >
            <div
              style={{
                font: "var(--type-label)",
                color: "var(--text-on-dark-muted)",
                letterSpacing: "var(--tracking-snug)",
              }}
            >
              What we never write
            </div>
            <div
              style={{
                display: "grid",
                gap: "var(--space-4)",
                marginTop: "var(--space-6)",
              }}
            >
              {GUARDRAILS.map((rule) => (
                <div
                  key={rule.code}
                  style={{
                    font: "var(--type-post-title)",
                    letterSpacing: "var(--tracking-snug)",
                    color: "var(--text-on-dark)",
                  }}
                >
                  {rule.text}
                </div>
              ))}
            </div>
            <div
              style={{
                marginTop: "var(--space-8)",
                font: "var(--type-body-sm)",
                color: "var(--text-on-dark-muted)",
                maxWidth: "44em",
              }}
            >
              These hold on every draft and every regeneration, so a reply
              can&rsquo;t commit you to something you didn&rsquo;t agree to.
            </div>
          </div>

          {error ? (
            <div
              role="alert"
              style={{
                marginTop: "var(--space-6)",
                font: "var(--type-body-sm)",
                background: "var(--surface-subtle)",
                borderRadius: "var(--radius-md)",
                padding: "var(--space-4) var(--space-5)",
              }}
            >
              {error}
            </div>
          ) : null}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
              flexWrap: "wrap",
              marginTop: "var(--space-10)",
            }}
          >
            <Button
              variant="primary"
              size="md"
              onClick={finish}
              disabled={pending}
            >
              {pending ? "Setting up your queue" : "Start reviewing"}
            </Button>
            <Button variant="ghost" size="md" onClick={() => setStep(2)}>
              Back
            </Button>
          </div>

          {pending ? (
            <p
              style={{
                margin: "var(--space-5) 0 0",
                font: "var(--type-meta)",
                color: "var(--text-faint)",
                maxWidth: "44em",
              }}
            >
              We&rsquo;re pulling in your reviews and drafting what we safely
              can. Model calls are rate-limited to stay inside the free tier, so
              this takes a minute.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
