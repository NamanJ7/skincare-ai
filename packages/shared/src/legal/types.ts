/**
 * Structure for Pore's legal documents.
 *
 * The documents are modelled as data rather than markup so the marketing site
 * and the mobile app render byte-identical text from one source. Presentation
 * (typography, cards, the section index) belongs to each client; the wording
 * belongs here.
 */

/** A single unit of content inside a section. */
export type LegalBlock =
  /** Running prose. The default. */
  | { kind: "paragraph"; text: string }
  /** A highlighted gap/limitation the document itself calls out. */
  | { kind: "note"; title: string; text: string }
  /** The standing medical disclaimer, rendered in its own quiet panel. */
  | { kind: "disclaimer"; text: string }
  /** A contact hand-off. `text` is UI chrome; `email` is the real address. */
  | { kind: "contact"; text: string; email: string };

export type LegalSection = {
  /** Stable anchor/scroll id. Used as the `#hash` on web. */
  id: string;
  title: string;
  blocks: LegalBlock[];
};

export type LegalDocument = {
  id: string;
  /** Document title, shown as the page H1. */
  title: string;
  /** Short status line describing the document's maturity. */
  lede: string;
  /** Badge copy, e.g. "Pre-launch draft". */
  status: string;
  /** Human-readable revision date shown under the title. */
  lastUpdated: string;
  sections: LegalSection[];
};
