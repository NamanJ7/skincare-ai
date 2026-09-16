import { Section, SectionHeading } from "../ui/Section";
import { Reveal } from "../ui/Reveal";
import { CameraIcon, LeafIcon, ChartIcon } from "../ui/icons";

const STEPS = [
  {
    n: "1",
    icon: <CameraIcon size={22} />,
    title: "Three guided photos",
    body: "Straight on, then each side. Your screen lights your face, so all three are taken under the same light and can be compared to the next set weeks later.",
  },
  {
    n: "2",
    icon: <LeafIcon size={22} />,
    title: "Five questions",
    body: "Goals, skin type, how reactive your skin is, pregnancy, and anything that has reacted badly before. That last one is removed from your routine outright.",
  },
  {
    n: "3",
    icon: <ChartIcon size={22} />,
    title: "One thing to do tonight",
    body: "Pore works out which steps land on which day and shows you only those. The single question it asks back — how does your skin feel — is what sets next week's pace.",
  },
];

export function HowItWorks() {
  return (
    <Section id="how-it-works" tone="canvas">
      <Reveal>
        <SectionHeading
          eyebrow="How it works"
          title="Three photos, five questions, and one thing to do tonight."
        />
      </Reveal>

      <div className="relative mt-14">
        {/* connecting line (desktop) */}
        <div
          aria-hidden
          className="absolute left-0 right-0 top-7 hidden h-px bg-gradient-to-r from-transparent via-hairline to-transparent lg:block"
        />
        <div className="grid gap-8 lg:grid-cols-3 lg:gap-6">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 100}>
              <div className="relative flex flex-col items-center text-center lg:items-start lg:text-left">
                <div className="relative z-10 flex items-center gap-3">
                  <span className="grid h-14 w-14 place-items-center rounded-2xl bg-primary text-on-primary shadow-[var(--shadow-card)]">
                    {step.icon}
                  </span>
                  <span className="font-display text-5xl font-semibold text-primary/15">
                    {step.n}
                  </span>
                </div>
                <h3 className="mt-5 font-display text-xl text-ink">{step.title}</h3>
                <p className="mt-2 max-w-xs text-base leading-relaxed text-ink-muted lg:max-w-none">
                  {step.body}
                </p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </Section>
  );
}
