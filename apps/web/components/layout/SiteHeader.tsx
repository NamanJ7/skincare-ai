"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Logo } from "./Logo";
import { Button } from "../ui/Button";
import { WaitlistButton } from "../ui/WaitlistButton";
import { NAV_LINKS } from "@/lib/nav";

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Lock body scroll while the mobile drawer is open.
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50">
      <div
        className={`transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          scrolled
            ? "border-b border-hairline bg-canvas/85 backdrop-blur-md"
            : "border-b border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex h-16 w-full max-w-[1180px] items-center justify-between gap-4 px-5 sm:h-[72px] sm:px-8">
          <Logo />

          <nav className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-pill px-3.5 py-2 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 lg:flex">
            <Button href="/login" variant="ghost" size="md">
              Log in
            </Button>
            <WaitlistButton size="md" />
          </div>

          {/* Mobile toggle */}
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-pill border border-hairline bg-surface text-ink lg:hidden"
          >
            <HamburgerIcon open={open} />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <div
        className={`fixed inset-x-0 top-16 z-40 origin-top px-5 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] lg:hidden ${
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <div className="rounded-xl border border-hairline bg-surface p-4 shadow-[var(--shadow-lift)]">
          <nav className="flex flex-col">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-medium text-ink transition-colors hover:bg-ink/5"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-hairline pt-4">
            <Button href="/login" variant="secondary" size="lg">
              Log in
            </Button>
            <WaitlistButton size="lg" className="w-full" />
          </div>
        </div>
      </div>
    </header>
  );
}

function HamburgerIcon({ open }: { open: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d={open ? "M5 5l10 10" : "M3 6h14"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d={open ? "M15 5L5 15" : "M3 10h14"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {!open && (
        <path d="M3 14h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  );
}
