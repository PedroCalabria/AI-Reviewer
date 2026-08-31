import { Button } from "@/components/ds/Button";

export default function SignInPage() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-12) var(--container-gutter) var(--section-y)",
      }}
    >
      <div style={{ width: "100%", maxWidth: 460 }}>
        <div
          style={{
            font: "var(--type-label)",
            color: "var(--text-muted)",
            letterSpacing: "var(--tracking-snug)",
          }}
        >
          Review Desk
        </div>
        <h1
          style={{
            margin: "var(--space-6) 0 var(--space-5)",
            font: "var(--type-section-title)",
            fontSize: "clamp(30px, 4vw, var(--size-h2))",
            letterSpacing: "var(--tracking-tight)",
          }}
        >
          Answer every review in your own voice
        </h1>
        <p
          style={{
            margin: "0 0 var(--space-10)",
            font: "var(--type-body)",
            color: "var(--text-muted)",
          }}
        >
          Drafts are written for you and wait for your approval. Nothing
          publishes on its own.
        </p>

        <Button variant="primary" size="lg" fullWidth href="/onboarding">
          Continue with Google
        </Button>

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
          We request read and reply access to your Business Profile reviews. You
          approve every reply before it goes out.
        </p>
      </div>
    </div>
  );
}
