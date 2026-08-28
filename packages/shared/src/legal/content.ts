/**
 * Pore's legal copy — the single source of truth for both clients.
 *
 * IMPORTANT: the wording below is reproduced verbatim from the pre-launch
 * pages it replaced (apps/web/app/(site)/privacy and /terms). The redesign
 * regrouped the existing sentences under headings so the documents can be
 * scanned; it did not add, remove, soften, or reinterpret a single word.
 * Treat every string here as legal text — restructure freely, reword never.
 */
import type { LegalDocument } from "./types";

/**
 * The standing non-diagnostic disclaimer shown across the site.
 * Relocated unchanged from apps/web/lib/nav.ts so mobile can reach it too.
 */
export const MEDICAL_DISCLAIMER =
  "Pore provides skincare education and routine guidance and is not a substitute for professional medical advice.";

/** Where privacy and legal questions go. Matches the /contact page. */
export const LEGAL_CONTACT_EMAIL = "reachporeai@gmail.com";

/**
 * Revision date shown on both documents. There was no prior value in the
 * repo — bump this whenever any string in this file changes.
 */
export const LEGAL_LAST_UPDATED = "August 2026";

/** Badge copy. Both documents still describe themselves as placeholders. */
const PRE_LAUNCH = "Pre-launch draft";

export const PRIVACY_POLICY: LegalDocument = {
  id: "privacy",
  title: "Privacy Policy",
  lede:
    "This is a placeholder privacy policy for the Pore pre-launch site. A full policy will be published before launch.",
  status: PRE_LAUNCH,
  lastUpdated: LEGAL_LAST_UPDATED,
  sections: [
    {
      id: "what-we-collect",
      title: "What we collect",
      blocks: [
        {
          kind: "paragraph",
          text: "Pore collects only the information needed to operate the waitlist and, in the future, to provide personalized skincare guidance.",
        },
      ],
    },
    {
      id: "selling-your-information",
      title: "Selling your information",
      blocks: [
        {
          kind: "paragraph",
          text: "We do not sell your personal information.",
        },
      ],
    },
    {
      id: "third-party-services",
      title: "Third-party services",
      blocks: [
        {
          kind: "paragraph",
          text: "Waitlist signups are handled through our form provider.",
        },
      ],
    },
    {
      id: "not-yet-covered",
      title: "Not yet covered",
      blocks: [
        {
          kind: "note",
          title: "Still to come",
          text: "When the product launches, this page will be replaced with a complete policy covering data storage, photo handling, retention, and your rights.",
        },
      ],
    },
    {
      id: "medical-disclaimer",
      title: "Medical disclaimer",
      blocks: [{ kind: "disclaimer", text: MEDICAL_DISCLAIMER }],
    },
    {
      id: "contact",
      title: "Contact",
      blocks: [
        {
          kind: "contact",
          text: "Questions about this policy, or about the information tied to you?",
          email: LEGAL_CONTACT_EMAIL,
        },
      ],
    },
  ],
};

export const TERMS_OF_USE: LegalDocument = {
  id: "terms",
  title: "Terms of Use",
  lede:
    "This is a placeholder set of terms for the Pore pre-launch site. Full terms will be published before launch.",
  status: PRE_LAUNCH,
  lastUpdated: LEGAL_LAST_UPDATED,
  sections: [
    {
      id: "what-pore-is",
      title: "What Pore is",
      blocks: [
        {
          kind: "paragraph",
          text: "Pore provides personalized skincare education and routine guidance.",
        },
      ],
    },
    {
      id: "not-medical-advice",
      title: "Not medical advice",
      blocks: [
        {
          kind: "paragraph",
          text: "It is intended to support your skincare journey, not to diagnose, treat, or replace professional medical advice.",
        },
      ],
    },
    {
      id: "waitlist-emails",
      title: "Waitlist emails",
      blocks: [
        {
          kind: "paragraph",
          text: "By joining the waitlist you agree to receive occasional product updates. You can unsubscribe at any time.",
        },
      ],
    },
    {
      id: "not-yet-covered",
      title: "Not yet covered",
      blocks: [
        {
          kind: "note",
          title: "Still to come",
          text: "Complete terms governing accounts, subscriptions, and acceptable use will be published when the product launches.",
        },
      ],
    },
    {
      id: "medical-disclaimer",
      title: "Medical disclaimer",
      blocks: [{ kind: "disclaimer", text: MEDICAL_DISCLAIMER }],
    },
    {
      id: "contact",
      title: "Contact",
      blocks: [
        {
          kind: "contact",
          text: "Questions about these terms?",
          email: LEGAL_CONTACT_EMAIL,
        },
      ],
    },
  ],
};

/** Every document, in the order they appear in the footer. */
export const LEGAL_DOCUMENTS: LegalDocument[] = [PRIVACY_POLICY, TERMS_OF_USE];
