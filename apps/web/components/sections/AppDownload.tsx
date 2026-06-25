import { Section } from "../ui/Section";
import { Reveal } from "../ui/Reveal";
import { Glow } from "../ui/Glow";
import { WaitlistButton } from "../ui/WaitlistButton";

export function AppDownload() {
  return (
    <Section tone="primary">
      <Reveal>
        <div className="relative mx-auto max-w-3xl text-center">
          <Glow tone="lavender" size={420} className="left-1/2 top-[-120px] -translate-x-1/2" />
          <h2 className="font-display text-3xl leading-tight text-on-primary sm:text-4xl">
            Pore is coming with you.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-on-primary/80">
            Start on the web. Continue your routine wherever life takes you.
            Mobile access is coming soon.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <StoreBadge store="apple" />
            <StoreBadge store="google" />
          </div>

          <div className="mt-8 flex justify-center">
            <WaitlistButton size="lg" variant="soft" />
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

function StoreBadge({ store }: { store: "apple" | "google" }) {
  return (
    <div className="inline-flex items-center gap-3 rounded-2xl border border-on-primary/15 bg-on-primary/5 px-5 py-3 text-on-primary/80">
      <span className="text-on-primary/90">
        {store === "apple" ? <AppleGlyph /> : <PlayGlyph />}
      </span>
      <span className="text-left">
        <span className="block text-[10px] uppercase tracking-wide text-on-primary/60">
          Coming soon to
        </span>
        <span className="block text-sm font-semibold">
          {store === "apple" ? "the App Store" : "Google Play"}
        </span>
      </span>
    </div>
  );
}

function AppleGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
      <path d="M16.4 12.9c0-2.2 1.8-3.3 1.9-3.3-1-1.5-2.6-1.7-3.2-1.7-1.4-.1-2.7.8-3.3.8-.7 0-1.7-.8-2.8-.8-1.4 0-2.8.8-3.5 2.1-1.5 2.6-.4 6.5 1.1 8.6.7 1 1.5 2.2 2.6 2.2 1 0 1.4-.7 2.7-.7 1.2 0 1.6.7 2.7.7 1.1 0 1.8-1 2.5-2 .8-1.2 1.1-2.3 1.1-2.4-.1 0-2.1-.8-2.1-3.6ZM14.3 6.3c.6-.7 1-1.7.9-2.7-.8 0-1.9.6-2.5 1.3-.5.6-1 1.6-.9 2.6.9.1 1.9-.5 2.5-1.2Z" />
    </svg>
  );
}

function PlayGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M4 3.5c-.3.2-.5.5-.5 1v15c0 .5.2.8.5 1l8.5-8.5L4 3.5Z" />
      <path d="M14 10l-2.2-2.2 5.1-2.9c.6-.3 1.2.4.7 1L14 10Z" opacity=".85" />
      <path d="M14 14l3.6 4.1c.5.6-.1 1.3-.7 1l-5.1-2.9L14 14Z" opacity=".7" />
      <path d="M14 10l3.8 2.2c.7.4.7 1.2 0 1.6L14 14l-2.2-2 2.2-2Z" opacity=".55" />
    </svg>
  );
}
