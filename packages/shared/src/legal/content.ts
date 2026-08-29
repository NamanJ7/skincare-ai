/**
 * Pore's legal copy — the single source of truth for both clients.
 *
 * IMPORTANT: the original wording is reproduced verbatim from the pre-launch
 * pages it replaced (apps/web/app/(site)/privacy and /terms). The redesign
 * regrouped the existing sentences under headings; it did not add, remove,
 * soften, or reinterpret a single word of them.
 *
 * Sentences marked "Disclosure" below were added later. Each states a fact
 * about how the deployed site behaves, verified against the code — never a
 * promise, a retention period, or a commitment. Anything not determinable
 * from the code is left to the "Not yet covered" note instead of guessed at.
 *
 * If the site's data flow changes, these sentences must change with it. In
 * particular: adding analytics, adding a second form provider, or wiring
 * app/api/waitlist/route.ts up to a client would each make the current text
 * wrong. Treat every string here as legal text — restructure freely, reword
 * never.
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
        {
          // Disclosure. Fields come from the onboarding screens in
          // apps/mobile/src/app/onboarding and types/intake.ts.
          kind: "paragraph",
          text: "In the Pore app you tell us your age, your skin goals and concerns, how sensitive your skin is, any ingredient allergies, and whether you are pregnant or breastfeeding. If you are 17 or younger we also ask for a parent or guardian's email address.",
        },
        {
          // Disclosure. state/onboarding.tsx holds this in a plain useState
          // with no persistence layer, and there is no account backend.
          kind: "paragraph",
          text: "Your answers are held on your device for the length of the session. Pore has no accounts yet, so nothing is saved to a profile.",
        },
      ],
    },
    {
      id: "photos-and-ai",
      title: "Photos and AI analysis",
      blocks: [
        {
          // Disclosure. apps/web/lib/pipeline.ts sends up to 3 images
          // (input.images.slice(0, 3)) to the Anthropic SDK.
          kind: "paragraph",
          text: "To build your routine, the app sends your answers and up to three photos to Pore's server, which passes them to Anthropic, the company behind the Claude AI models, for a cosmetic read of what is visible.",
        },
        {
          // Disclosure. Neither app/api/plan/route.ts nor lib/pipeline.ts
          // writes images to disk or logs them, and there is no database.
          kind: "paragraph",
          text: "Pore does not store your photos. They are used to produce your assessment and are not written to any Pore database.",
        },
        {
          kind: "note",
          title: "One thing we can't speak for",
          text: "How Anthropic handles the data it receives is governed by Anthropic's own terms, not this notice.",
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
        {
          // Disclosure. TALLY_FORM_ID in apps/web/lib/tally.ts; the widget
          // script is loaded site-wide in apps/web/app/layout.tsx.
          kind: "paragraph",
          text: "That provider is Tally. When you open or submit the waitlist form, the answers you give are sent to Tally, which holds them on our behalf.",
        },
        {
          // Disclosure. Verified in a browser: tally.so is the only
          // third-party host the site contacts on load.
          kind: "paragraph",
          text: "Tally's form script loads on every page of this site. Apart from that, this site does not load analytics or advertising trackers.",
        },
        {
          // Disclosure. @anthropic-ai/sdk in apps/web/lib/pipeline.ts. Named
          // by company, not model id, because model ids change.
          kind: "paragraph",
          text: "The app's skin analysis is performed by Anthropic. Those are the only two outside companies that receive information you give Pore.",
        },
      ],
    },
    {
      id: "age-requirements",
      title: "Age requirements",
      blocks: [
        {
          // Disclosure. apps/mobile/src/app/onboarding/age.tsx blocks under
          // 16 and routes 16-17 to the parental consent screen.
          kind: "paragraph",
          text: "Pore is for ages 16 and up. If you are 17 or younger, Pore asks for a parent or guardian's email address so they can approve your use of the app.",
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
      id: "eligibility",
      title: "Eligibility",
      blocks: [
        {
          // Disclosure. Mirrors the gate in onboarding/age.tsx: under 16 is
          // blocked outright, 16-17 is routed to parental consent.
          kind: "paragraph",
          text: "Pore is for ages 16 and up. If you are 17 or younger, you need a parent or guardian's approval to use the app.",
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
