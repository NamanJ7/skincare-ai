import type { Metadata } from "next";

import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Container";
import { LEGAL_LINKS, NAV_LINKS } from "@/lib/nav";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

/**
 * Root 404.
 *
 * `/blog/[slug]` calls `notFound()` for an unknown article, and until this file
 * existed that rendered Next's unstyled default page — no header, no way back,
 * nothing identifying it as Pore.
 */
export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center bg-canvas py-16">
      <Container>
        <div className="mx-auto max-w-xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            404
          </p>
          <h1 className="mt-4 font-display text-4xl leading-[1.06] text-ink sm:text-5xl">
            We couldn&apos;t find that page.
          </h1>
          <p className="mx-auto mt-5 max-w-md text-lg leading-relaxed text-ink-muted">
            The link may be out of date, or the page may have moved. Everything
            below still works.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button href="/" size="lg">
              Back to home
            </Button>
            <Button href="/features" variant="secondary" size="lg">
              Explore features
            </Button>
          </div>

          <nav aria-label="Other pages" className="mt-10">
            <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-ink-muted">
              {[...NAV_LINKS, ...LEGAL_LINKS].map((link) => (
                <li key={`${link.label}-${link.href}`}>
                  <a
                    className="hover:text-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    href={link.href}
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </Container>
    </main>
  );
}
