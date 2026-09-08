import { Section } from "../ui/Section";
import { Reveal } from "../ui/Reveal";
import { Glow } from "../ui/Glow";
import { DashboardMock } from "../mockups/DashboardMock";
import { CheckIcon } from "../ui/icons";

const BENEFITS = [
  "Three guided photos, shot under your screen's own light",
  "A routine clamped by rules that are code, not a prompt",
  "One strong active a day, spaced out for you",
  "Only tonight's session on screen — you never plan a night",
  "One tap a day is the whole ask, and it sets next week's pace",
  "A comparison that says \"we can't tell\" rather than inventing one",
];

export function WhyPore() {
  return (
    <Section id="why-pore" tone="surface">
      <div className="grid items-center gap-12 lg:grid-cols-2">
        {/* visual */}
        <Reveal className="relative order-2 lg:order-1">
          <Glow tone="lavender" size={420} className="-left-10 top-6" />
          <div className="relative">
            <DashboardMock />
          </div>
        </Reveal>

        {/* copy */}
        <Reveal delay={80} className="order-1 lg:order-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Why choose Pore?
          </p>
          <h2 className="mt-3 font-display text-3xl leading-tight text-ink sm:text-4xl">
            Less guessing. More clarity.
          </h2>

          <ul className="mt-7 space-y-3.5">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <CheckIcon size={14} />
                </span>
                <span className="text-base leading-relaxed text-ink">{b}</span>
              </li>
            ))}
          </ul>

          <p className="mt-7 rounded-2xl border border-[#e4dcf3] bg-accent-soft px-5 py-4 font-display text-lg leading-snug text-accent-ink">
            Your skin does not need a 12-step routine. It needs the right routine.
          </p>
        </Reveal>
      </div>
    </Section>
  );
}
