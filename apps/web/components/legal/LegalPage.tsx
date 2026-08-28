import Link from "next/link";
import type { LegalDocument } from "@pore/shared";
import { Container } from "@/components/ui/Container";
import { Badge } from "@/components/ui/Badge";
import { ArrowIcon } from "@/components/ui/icons";
import { LegalBlockView } from "./blocks";

/**
 * Shell for a long-form legal document.
 *
 * Deliberately free of the site's scroll-reveal animation: `.reveal` starts at
 * opacity 0, so wrapping legal copy in it would hide the text whenever the
 * IntersectionObserver doesn't run. Legal content always renders.
 *
 * The section index is plain `#` anchors — globals.css already sets
 * `scroll-behavior: smooth` and `scroll-padding-top: 96px` to clear the sticky
 * header, so no client JavaScript is involved.
 */
export function LegalPage({ doc }: { doc: LegalDocument }) {
  const tocId = `${doc.id}-contents`;

  return (
    <div id="top" className="pb-20 sm:pb-28">
      {/* Header */}
      <Container>
        <div className="border-b border-hairline py-10 sm:py-14">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
          >
            <ArrowIcon size={15} className="rotate-180" aria-hidden="true" />
            Back to home
          </Link>

          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            Legal
          </p>
          <h1 className="mt-3 font-display text-4xl leading-[1.08] text-ink sm:text-5xl">
            {doc.title}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <Badge tone="soon">{doc.status}</Badge>
            <span className="text-sm text-ink-muted">
              Last updated {doc.lastUpdated}
            </span>
          </div>

          <p className="mt-5 max-w-[60ch] text-[17px] leading-[1.7] text-ink-muted">
            {doc.lede}
          </p>
        </div>
      </Container>

      {/* Index + document */}
      <Container>
        <div className="pt-10 sm:pt-12 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14">
          <nav
            aria-labelledby={tocId}
            className="mb-10 lg:mb-0 lg:sticky lg:top-28 lg:self-start"
          >
            <h2
              id={tocId}
              className="text-xs font-semibold uppercase tracking-[0.18em] text-ink-muted"
            >
              In this document
            </h2>
            <ol className="mt-4 space-y-1 rounded-xl border border-hairline bg-surface p-2 lg:border-0 lg:bg-transparent lg:p-0 lg:space-y-2.5">
              {doc.sections.map((section, i) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-3 text-[15px] leading-snug text-ink-muted transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 lg:min-h-0 lg:px-0 lg:py-1 lg:hover:bg-transparent"
                  >
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-xs font-semibold tabular-nums text-primary"
                    >
                      {i + 1}
                    </span>
                    {section.title}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <article className="max-w-[68ch]">
            {doc.sections.map((section, i) => (
              <section
                key={section.id}
                id={section.id}
                aria-labelledby={`${section.id}-heading`}
                className="border-hairline pt-10 first:pt-0 [&+section]:border-t"
              >
                <h2
                  id={`${section.id}-heading`}
                  className="font-display text-2xl leading-snug text-ink sm:text-[26px]"
                >
                  <span
                    aria-hidden="true"
                    className="mr-2.5 text-base font-semibold tabular-nums text-primary"
                  >
                    {i + 1}
                  </span>
                  {section.title}
                </h2>
                <div className="mt-4 space-y-4 pb-10">
                  {section.blocks.map((block, j) => (
                    <LegalBlockView key={j} block={block} />
                  ))}
                </div>
              </section>
            ))}

            <div className="border-t border-hairline pt-8">
              <a
                href="#top"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
              >
                <ArrowIcon size={15} className="-rotate-90" aria-hidden="true" />
                Back to top
              </a>
            </div>
          </article>
        </div>
      </Container>
    </div>
  );
}
