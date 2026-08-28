import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { LEGAL_LINKS, MEDICAL_DISCLAIMER } from "@/lib/nav";

/** Minimal chrome for login / sign-up: just the logo and a quiet disclaimer. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <header className="px-5 py-5 sm:px-8">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 py-8 sm:py-12">
        {children}
      </main>
      <footer className="px-5 pb-8 sm:px-8">
        <p className="mx-auto max-w-xl text-center text-xs leading-relaxed text-ink-muted">
          {MEDICAL_DISCLAIMER}{" "}
          <Link href="/" className="underline underline-offset-2 hover:text-ink">
            Back to home
          </Link>
        </p>
        <nav
          aria-label="Legal"
          className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2"
        >
          {LEGAL_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs text-ink-muted underline underline-offset-4 transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </footer>
    </div>
  );
}
