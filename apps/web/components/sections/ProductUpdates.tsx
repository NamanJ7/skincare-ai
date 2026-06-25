import { Section, SectionHeading } from "../ui/Section";
import { Reveal } from "../ui/Reveal";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PRODUCT_UPDATES } from "@/lib/updates";

export function ProductUpdates() {
  return (
    <Section id="updates" tone="canvas">
      <Reveal>
        <SectionHeading
          eyebrow="Product updates"
          title="Built in public. Made for real routines."
        />
      </Reveal>

      <div className="mt-12 grid gap-5 md:grid-cols-3">
        {PRODUCT_UPDATES.map((u, i) => (
          <Reveal key={u.id} delay={i * 80}>
            <article className="flex h-full flex-col rounded-2xl border border-hairline bg-surface p-6 shadow-[var(--shadow-card)]">
              <div className="flex items-center gap-2">
                <Badge tone={u.status === "live" ? "primary" : "soon"}>
                  {u.status === "live" ? "Live" : "Coming soon"}
                </Badge>
                <span className="text-[11px] font-medium text-ink-muted">
                  {u.date}
                </span>
              </div>
              <h3 className="mt-4 font-display text-lg leading-snug text-ink">
                {u.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                {u.body}
              </p>
            </article>
          </Reveal>
        ))}
      </div>

      <Reveal>
        <div className="mt-9 flex justify-center">
          <Button href="/blog" variant="secondary" size="md">
            View All Updates
          </Button>
        </div>
      </Reveal>
    </Section>
  );
}
