import { Container } from "../ui/Container";
import { Button } from "../ui/Button";
import { WaitlistButton } from "../ui/WaitlistButton";
import { Reveal } from "../ui/Reveal";
import { Glow } from "../ui/Glow";
import { DashboardMock } from "../mockups/DashboardMock";
import { CheckIcon, SparkleIcon, ChartIcon, CameraIcon } from "../ui/icons";

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-16 pt-10 sm:pb-24 sm:pt-16">
      {/* ambient glows */}
      <Glow tone="lavender" size={560} className="left-[-160px] top-[-120px]" />
      <Glow
        tone="green"
        size={420}
        className="right-[-120px] top-[280px]"
        animate={false}
      />

      <Container className="relative">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
          {/* copy */}
          <div>
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                Face photo guidance
              </p>
            </Reveal>
            <Reveal delay={60}>
              <h1
                aria-label="Turn skincare confusion into clear routines."
                className="mt-4 max-w-3xl text-5xl font-semibold leading-[0.98] tracking-normal text-ink sm:text-6xl lg:text-7xl"
              >
                Turn skincare confusion into
                <br />
                <span className="hero-emphasis-text block pb-2 font-display text-6xl font-semibold italic leading-[0.9] tracking-normal sm:text-7xl lg:text-8xl">
                  clear routines.
                </span>
              </h1>
            </Reveal>
            <Reveal delay={120}>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-muted">
                Pore helps you build, track, and improve your skincare routine
                by starting with a guided photo of your face, then pairing what
                it sees with your products, goals, and progress.
              </p>
            </Reveal>
            <Reveal delay={180}>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <WaitlistButton size="lg" />
                <Button href="#how-it-works" variant="secondary" size="lg">
                  Explore How It Works
                </Button>
              </div>
            </Reveal>
            <Reveal delay={240}>
              <p className="mt-6 flex items-center gap-2 text-sm text-ink-muted">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-primary/10 text-primary">
                  <CheckIcon size={12} />
                </span>
                Face photo first. Smarter product choices. Clearer progress.
              </p>
            </Reveal>
          </div>

          {/* visual */}
          <Reveal delay={140} className="relative">
            <div className="relative mx-auto max-w-lg">
              <DashboardMock className="animate-float-slow" />

              {/* floating callouts */}
              <FloatCard
                className="absolute -left-4 top-16 hidden sm:flex"
                icon={<CameraIcon size={14} />}
                tone="primary"
                title="Face photo scan"
                sub="Visible cues mapped"
              />
              <FloatCard
                className="absolute -right-3 bottom-20 hidden sm:flex"
                icon={<ChartIcon size={14} />}
                tone="lavender"
                title="92% consistency"
                sub="Up this week"
              />
              <FloatCard
                className="absolute -bottom-4 left-10 hidden md:flex"
                icon={<SparkleIcon size={14} />}
                tone="gold"
                title="Routine updated"
                sub="Added SPF to AM"
              />
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}

function FloatCard({
  icon,
  title,
  sub,
  tone,
  className = "",
}: {
  icon: React.ReactNode;
  title: string;
  sub: string;
  tone: "primary" | "lavender" | "gold";
  className?: string;
}) {
  const chip =
    tone === "primary"
      ? "bg-primary text-on-primary"
      : tone === "lavender"
        ? "bg-accent text-accent-ink"
        : "bg-[#f0e9da] text-[#8a754f]";
  return (
    <div
      className={`animate-float items-center gap-2.5 rounded-2xl border border-hairline bg-surface px-3.5 py-2.5 shadow-[var(--shadow-lift)] ${className}`}
      style={{ animationDelay: `${tone === "lavender" ? 1.5 : tone === "gold" ? 3 : 0}s` }}
    >
      <span className={`grid h-8 w-8 place-items-center rounded-xl ${chip}`}>
        {icon}
      </span>
      <div>
        <p className="text-xs font-semibold text-ink">{title}</p>
        <p className="text-[10px] text-ink-muted">{sub}</p>
      </div>
    </div>
  );
}
