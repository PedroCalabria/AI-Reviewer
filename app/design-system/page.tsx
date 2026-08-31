import { Badge } from "@/components/ds/Badge";
import { Button } from "@/components/ds/Button";
import { IconButton } from "@/components/ds/IconButton";
import { MetaLine } from "@/components/ds/MetaLine";
import { SectionHeading } from "@/components/ds/SectionHeading";

export const metadata = {
  title: "Design tokens · Review Desk",
};

const INK_RAMP = [
  { token: "ink-1000", use: "Type, escalated slabs" },
  { token: "ink-800", use: "Button hover" },
  { token: "ink-600", use: "Muted text" },
  { token: "ink-300", use: "Outline controls" },
  { token: "ink-200", use: "Hairlines" },
  { token: "ink-100", use: "Selected rows" },
];

export default function DesignSystemPage() {
  return (
    <div
      style={{
        maxWidth: "var(--container-max)",
        margin: "0 auto",
        padding:
          "var(--section-y-tight) var(--container-gutter) var(--section-y)",
        width: "100%",
      }}
    >
      <div
        style={{
          font: "var(--type-label)",
          color: "var(--text-muted)",
          letterSpacing: "var(--tracking-snug)",
          marginBottom: "var(--space-4)",
        }}
      >
        Design tokens in use
      </div>
      <h1
        style={{
          margin: "0 0 var(--space-5)",
          font: "var(--type-hero)",
          fontSize: "clamp(32px, 4.6vw, var(--size-display-1))",
          letterSpacing: "var(--tracking-tight)",
          maxWidth: "20em",
        }}
      >
        Review Desk on Journal X
      </h1>
      <p
        style={{
          margin: "0 0 var(--space-16)",
          maxWidth: "52em",
          font: "var(--type-body)",
          color: "var(--text-muted)",
        }}
      >
        The interface is monochrome: one typeface, the ink ramp, two greys for
        structure, and pills for every control. Severity is carried by inversion
        rather than colour — an escalated review is a black slab, never a red
        one.
      </p>

      <section style={{ marginBottom: "var(--space-12)" }}>
        <SectionHeading variant="label" title="Ink ramp" />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: "var(--space-4)",
            marginTop: "var(--space-8)",
          }}
        >
          {INK_RAMP.map((swatch) => (
            <div key={swatch.token}>
              <div
                style={{
                  height: 72,
                  borderRadius: "var(--radius-md)",
                  background: `var(--${swatch.token})`,
                  border:
                    swatch.token === "ink-100"
                      ? "1px solid var(--border-subtle)"
                      : undefined,
                }}
              />
              <div style={{ marginTop: "var(--space-3)", font: "var(--type-label)" }}>
                {swatch.token}
              </div>
              <div
                style={{
                  marginTop: 4,
                  font: "var(--type-meta)",
                  color: "var(--text-muted)",
                }}
              >
                {swatch.use}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: "var(--space-12)" }}>
        <SectionHeading variant="label" title="Type" />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "var(--space-10)",
            marginTop: "var(--space-8)",
          }}
        >
          <div>
            <div
              style={{
                font: "var(--type-card-title)",
                letterSpacing: "var(--tracking-tight)",
              }}
            >
              Waited 40 minutes for a table we had booked.
            </div>
            <div
              style={{
                marginTop: "var(--space-4)",
                font: "var(--type-meta)",
                color: "var(--text-muted)",
              }}
            >
              Review text — card title, 32/1.24, bold, −0.02em
            </div>
          </div>
          <div>
            <div style={{ font: "var(--type-body)" }}>
              Marcus, thank you for telling us. A 40-minute wait on a table you
              had booked isn&rsquo;t the experience we want anyone to have.
            </div>
            <div
              style={{
                marginTop: "var(--space-4)",
                font: "var(--type-meta)",
                color: "var(--text-muted)",
              }}
            >
              Draft reply — body, 16/1.6, regular
            </div>
          </div>
          <div>
            <MetaLine category="Escalated" date="Sep 1, 2023" />
            <div
              style={{
                marginTop: "var(--space-4)",
                font: "var(--type-meta)",
                color: "var(--text-muted)",
              }}
            >
              Metadata — meta line, 14px medium, category in ink
            </div>
          </div>
        </div>
      </section>

      <section>
        <SectionHeading variant="label" title="Controls and corners" />
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--space-4)",
            alignItems: "center",
            marginTop: "var(--space-8)",
          }}
        >
          <Button variant="primary" size="md">
            Approve and publish
          </Button>
          <Button variant="outline" size="md">
            Regenerate
          </Button>
          <Button variant="ghost" size="md">
            Skip
          </Button>
          <Badge variant="dark" size="sm">
            Escalated
          </Badge>
          <IconButton
            icon="arrow-up-right"
            label="Open"
            variant="outline"
            size="md"
          />
        </div>
        <div
          style={{
            marginTop: "var(--space-8)",
            font: "var(--type-meta)",
            color: "var(--text-muted)",
          }}
        >
          Controls are pills (999px). Cards 20px, bands 24px, panels 14px. No
          shadow at rest.
        </div>
      </section>
    </div>
  );
}
