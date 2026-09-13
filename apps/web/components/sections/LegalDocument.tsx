import { formatLegalDate, type LegalDocument as LegalDoc } from "@pore/shared/legal";

import { PageHero } from "./PageHero";
import { Section } from "../ui/Section";
import { MEDICAL_DISCLAIMER } from "@/lib/nav";

/**
 * Renders a legal document from `@pore/shared/legal`.
 *
 * The app renders the same object with its own primitives, so the public copy
 * and the in-app copy cannot drift. They previously did: the website described
 * a waitlist as the primary dataset long after the app had its own account
 * system, and the app pointed at a domain that was never registered.
 */
export function LegalDocument({ document }: { document: LegalDoc }) {
  return (
    <>
      <PageHero eyebrow="Legal" title={document.title} lede={document.lede} />
      <Section tone="canvas" className="pt-0 sm:pt-0">
        <article className="mx-auto max-w-2xl space-y-8 text-base leading-relaxed text-ink-muted">
          <p>
            <strong className="text-ink">
              Effective {formatLegalDate(document.effectiveDate)}
            </strong>
            {" · "}
            Last updated {formatLegalDate(document.lastUpdated)}
          </p>

          {document.intro.map((paragraph, index) => (
            <p key={index}>{paragraph}</p>
          ))}

          <nav aria-label={`${document.title} contents`} className="rounded-2xl border border-hairline bg-surface px-5 py-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-ink">
              Contents
            </h2>
            <ol className="mt-3 grid gap-1.5 sm:grid-cols-2">
              {document.sections.map((section, index) => (
                <li key={section.id} className="text-sm">
                  <a
                    className="text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    href={`#${section.id}`}
                  >
                    {index + 1}. {section.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          {document.sections.map((section) => (
            <div key={section.id} id={section.id} className="scroll-mt-24 space-y-3">
              <h2 className="text-xl font-semibold text-ink">{section.heading}</h2>
              {section.body.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
              {section.bullets ? (
                <ul className="list-disc space-y-1.5 pl-6">
                  {section.bullets.map((bullet, index) => (
                    <li key={index}>{bullet}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}

          <p className="rounded-2xl border border-hairline bg-surface px-5 py-4 text-sm">
            {MEDICAL_DISCLAIMER}
          </p>
        </article>
      </Section>
    </>
  );
}
