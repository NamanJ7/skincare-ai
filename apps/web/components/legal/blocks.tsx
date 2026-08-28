import type { LegalBlock } from "@pore/shared";
import { AlertIcon, ArrowIcon } from "@/components/ui/icons";

/**
 * The content pieces of a legal document. Deliberately plain: prose is prose,
 * and only the two things a reader genuinely needs to spot at a glance — a
 * called-out gap and the standing disclaimer — get a container.
 */

/** Highlighted limitation the document calls out about itself. */
function Note({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-accent-soft p-5 sm:p-6">
      <p className="flex items-center gap-2 font-semibold text-accent-ink">
        <AlertIcon size={17} aria-hidden="true" />
        {title}
      </p>
      <p className="mt-2 text-[17px] leading-[1.7] text-ink-muted">{text}</p>
    </div>
  );
}

/** The standing non-diagnostic disclaimer. Quiet, not alarming. */
function Disclaimer({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-5 sm:p-6">
      <p className="text-[17px] leading-[1.7] text-ink-muted">{text}</p>
    </div>
  );
}

/**
 * Contact hand-off. The mailto is the one real, working action on these pages,
 * so it reads as a button rather than a link buried in a sentence.
 */
function Contact({ text, email }: { text: string; email: string }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-5 sm:p-6">
      <p className="text-[17px] leading-[1.7] text-ink-muted">{text}</p>
      <a
        href={`mailto:${email}`}
        className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-pill bg-primary px-5 py-3 text-sm font-semibold !text-on-primary transition-colors duration-200 hover:bg-primary-press focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
      >
        Email {email}
        <ArrowIcon size={16} aria-hidden="true" />
      </a>
    </div>
  );
}

export function LegalBlockView({ block }: { block: LegalBlock }) {
  switch (block.kind) {
    case "paragraph":
      return <p className="text-[17px] leading-[1.75] text-ink-muted">{block.text}</p>;
    case "note":
      return <Note title={block.title} text={block.text} />;
    case "disclaimer":
      return <Disclaimer text={block.text} />;
    case "contact":
      return <Contact text={block.text} email={block.email} />;
  }
}
