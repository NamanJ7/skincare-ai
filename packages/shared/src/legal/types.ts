/**
 * Renderer-agnostic legal document model.
 *
 * One document, two renderers: `apps/web` paints it as marketing-site prose and
 * `apps/mobile` paints it with the app's own primitives. The alternative — a
 * hand-maintained copy per platform — is how the Terms and the Privacy Notice
 * drifted apart before, and how the app ended up pointing at a URL that no
 * longer described what the app did.
 */

export interface LegalSection {
  /** Stable anchor/key. Never reuse one across documents. */
  id: string;
  heading: string;
  /** Paragraphs, in order. Every entry must be non-empty prose. */
  body: string[];
  /** Optional bulleted list rendered after `body`. */
  bullets?: string[];
}

export interface LegalDocument {
  id: LegalDocumentId;
  /** Canonical user-facing name. The only name any surface may use. */
  title: string;
  /** One-sentence summary for page heroes and screen subtitles. */
  lede: string;
  /** ISO `YYYY-MM-DD`. When these terms began to apply. */
  effectiveDate: string;
  /** ISO `YYYY-MM-DD`. Must be >= `effectiveDate`. */
  lastUpdated: string;
  intro: string[];
  sections: LegalSection[];
}

export type LegalDocumentId = "terms" | "privacy";

/** Render an ISO date as the long form used in the document headers. */
export function formatLegalDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (!year || !month || !day) return iso;
  // Constructed in UTC and formatted in UTC so the printed date matches the
  // string regardless of the reader's timezone.
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
