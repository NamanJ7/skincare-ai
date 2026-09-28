import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { Button } from "@/components/ui/Button";
import { Glow } from "@/components/ui/Glow";
import { CheckIcon, SunIcon, SparkleIcon } from "@/components/ui/icons";
import { SOCIAL_LINKS } from "@/lib/nav";

export const metadata: Metadata = {
  title: "You're on the list",
  description: "Thanks for joining the Pore waitlist — here's what happens next.",
};

const NEXT = [
  { icon: <CheckIcon size={15} />, text: "You're on the early-access list — no further steps needed." },
  { icon: <SunIcon size={15} />, text: "We'll email launch announcements and product updates." },
  { icon: <SparkleIcon size={15} />, text: "Waitlist members get first access to new features." },
];

export default function WaitlistConfirmedPage() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-canvas">
      <Glow tone="lavender" size={560} className="left-1/2 top-[-160px] -translate-x-1/2" />

      <header className="relative px-5 py-5 sm:px-8">
        <Logo />
      </header>

      <main className="relative flex flex-1 items-center justify-center px-5 py-10">
        <div className="w-full max-w-xl text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary text-on-primary shadow-[var(--shadow-card)]">
            <CheckIcon size={30} />
          </span>

          <h1 className="mt-6 font-display text-4xl leading-tight text-ink sm:text-5xl">
            You&apos;re on the list.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-ink-muted">
            Thank you for joining the Pore waitlist. Your skincare routine is
            about to get a lot smarter — we&apos;ll be in touch soon.
          </p>

          <ul className="mx-auto mt-8 max-w-md space-y-3 text-left">
            {NEXT.map((item, i) => (
              <li
                key={i}
                className="flex items-center gap-3 rounded-2xl border border-hairline bg-surface px-4 py-3.5 shadow-[var(--shadow-card)]"
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  {item.icon}
                </span>
                <span className="text-sm text-ink">{item.text}</span>
              </li>
            ))}
          </ul>

          <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button href="/" size="lg">
              Back to home
            </Button>
            <Button href="/blog" variant="secondary" size="lg">
              Read the blog
            </Button>
          </div>

          <div className="mt-10">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">
              Follow along
            </p>
            <div className="mt-3 flex items-center justify-center gap-4">
              {SOCIAL_LINKS.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-ink-muted transition-colors hover:text-ink"
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        </div>
      </main>

      <footer className="relative px-5 pb-8 text-center">
        <Link href="/" className="text-xs text-ink-muted hover:text-ink">
          © {new Date().getFullYear()} Pore
        </Link>
      </footer>
    </div>
  );
}
