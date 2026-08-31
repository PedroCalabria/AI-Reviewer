import { redirect } from "next/navigation";
import { SignInForm } from "@/components/app/SignInForm";
import { currentTenant } from "@/lib/tenancy";

export default async function SignInPage() {
  // Somebody already signed in has no business on this screen.
  if (await currentTenant()) redirect("/inbox");

  const googleConfigured = Boolean(
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET,
  );

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

        <SignInForm googleConfigured={googleConfigured} />
      </div>
    </div>
  );
}
