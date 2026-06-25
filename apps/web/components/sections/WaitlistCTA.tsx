import { Section } from "../ui/Section";
import { Reveal } from "../ui/Reveal";
import { Glow } from "../ui/Glow";
import { WaitlistButton } from "../ui/WaitlistButton";
import { DashboardMock } from "../mockups/DashboardMock";
import { CheckIcon, SunIcon, ChartIcon } from "../ui/icons";

export function WaitlistCTA() {
  return (
    <Section id="waitlist" tone="canvas">
      <Reveal>
        <div className="relative overflow-hidden rounded-[32px] border border-[#e4dcf3] bg-accent-soft p-7 sm:p-12">
          <Glow tone="lavender" size={480} className="-right-20 -top-24" />
          <Glow tone="green" size={360} className="-bottom-24 -left-16" animate={false} />

          <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_0.9fr]">
            {/* copy + CTA */}
            <div>
              <h2 className="font-display text-3xl leading-tight text-ink sm:text-4xl">
                Your skincare routine is about to get smarter.
              </h2>
              <p className="mt-4 max-w-lg text-lg leading-relaxed text-ink-muted">
                Join the Pore waitlist for early access, product updates, launch
                announcements, and first access to new features.
              </p>
              <div className="mt-7">
                <WaitlistButton size="lg" />
              </div>
              <p className="mt-4 text-sm text-ink-muted">
                No spam. Just thoughtful updates from Pore.
              </p>
            </div>

            {/* blurred preview + floating cards */}
            <div className="relative mx-auto hidden max-w-sm lg:block">
              <div className="opacity-95 blur-[2px]">
                <DashboardMock className="animate-float-slow" />
              </div>
              <MiniCard
                className="absolute -left-6 top-10"
                icon={<SunIcon size={13} />}
                label="Personalized AM Routine"
              />
              <MiniCard
                className="absolute -right-4 top-1/2"
                icon={<CheckIcon size={13} />}
                label="Ingredient Check Complete"
              />
              <MiniCard
                className="absolute bottom-6 left-4"
                icon={<ChartIcon size={13} />}
                label="Progress Updated"
              />
            </div>
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

function MiniCard({
  icon,
  label,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  className?: string;
}) {
  return (
    <div
      className={`animate-float flex items-center gap-2 rounded-pill border border-hairline bg-surface px-3 py-2 shadow-[var(--shadow-lift)] ${className}`}
    >
      <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-on-primary">
        {icon}
      </span>
      <span className="whitespace-nowrap text-xs font-semibold text-ink">
        {label}
      </span>
    </div>
  );
}
