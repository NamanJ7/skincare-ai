import { LEGAL_CONFIG, legalValue } from "./config";
import type { LegalDocument } from "./types";

const c = LEGAL_CONFIG;

/**
 * Terms of Use.
 *
 * Product/legal copy written against what the app actually does. It has not
 * been reviewed by a lawyer and is not legal advice; filling in the pending
 * values in `config.ts` and getting a professional review are launch
 * prerequisites, tracked in `docs/legal-launch-checklist.md`.
 */
export const TERMS_OF_USE: LegalDocument = {
  id: "terms",
  title: "Terms of Use",
  lede: "The practical rules and limitations for using Pore.",
  effectiveDate: "2026-08-26",
  lastUpdated: "2026-08-26",
  intro: [
    `These Terms of Use ("Terms") are an agreement between you and ${legalValue(c.legalEntityName)} ("${c.productName}", "we", "us") covering the ${c.productName} mobile app, the ${c.productName} website, and the skin-analysis service behind them (together, the "Service").`,
    `Please read the ${c.productName} Privacy Notice alongside these Terms. It explains what the Service collects and why, and it forms part of your agreement with us.`,
  ],
  sections: [
    {
      id: "acceptance",
      heading: "Accepting these terms",
      body: [
        "By creating a profile, submitting questionnaire answers, running a scan, or otherwise using the Service, you agree to these Terms. If you do not agree, do not use the Service.",
        "If you are accepting on behalf of someone else — for example, a parent or guardian authorizing a teenager — you confirm that you have the authority to do so, and that you accept these Terms yourself as well.",
      ],
    },
    {
      id: "eligibility",
      heading: "Who may use Pore",
      body: [
        `You must be at least ${c.minimumAge} to use ${c.productName}. People under ${c.minimumAge} may not create a profile, provide questionnaire answers, or submit face photos, and we do not knowingly accept their information.`,
        "Ages 13 to 15 may use Pore only after a parent or legal guardian completes the in-app authorization. Ages 16 to 17 may make their own privacy choice through the teen consent flow. Everyone, at every age, is asked separately before any face photo is captured or analyzed.",
        "If you authorize a 13 to 15-year-old, you confirm that you are their parent or legal guardian, that you are at least 18, that you have reviewed the described data uses, and that you will keep the guardian PIN private. We may require renewed authorization after a material change to how we handle personal information.",
        "We may end access for anyone we reasonably believe is below the minimum age, or is relying on an authorization they are not entitled to.",
      ],
    },
    {
      id: "service",
      heading: "What the Service does",
      body: [
        "Pore provides skincare education, cosmetic observations about the appearance of skin, routine organization, reminders, and progress tracking. A scan combines three guided face photos with your questionnaire answers, sends them to our analysis service, and returns a cosmetic assessment and a suggested routine.",
        "Every routine is additionally checked by a deterministic safety layer that runs on our servers rather than inside the model. It enforces rules such as sunscreen in every morning routine, removal of ingredients you flagged as allergies, pregnancy-related exclusions, retinoid frequency ramping, and limits on how many strong actives appear in one session. Changes it makes are recorded and shown to you.",
      ],
    },
    {
      id: "cosmetic-only",
      heading: "Cosmetic guidance only, not medical advice",
      body: [
        "Pore is not a medical device, and nothing it produces is a diagnosis, a treatment plan, a prescription, or a guarantee of any result. Image analysis can be wrong, incomplete, or uncertain, and skin varies day to day for reasons no photo can reveal.",
        "Do not use Pore to diagnose or treat a condition, and do not delay professional care because of something Pore said. Seek qualified medical care for severe or painful acne, rapidly changing skin, rashes, suspected infection, concerning or changing moles, allergic reactions, or any urgent symptom.",
        "Stop using any product that causes significant irritation, and patch-test new products when appropriate. Deciding whether to use a product is your decision and your responsibility.",
      ],
    },
    {
      id: "accounts",
      heading: "Your account",
      body: [
        "The app creates an anonymous account for your device the first time it launches, so that onboarding works before you decide whether to sign up. Creating an account with an email address, or with Sign in with Apple, converts that same anonymous account in place and keeps the data already attached to it.",
        `You are responsible for keeping your sign-in credentials and any guardian PIN secure, and for activity that happens through your account. Tell us promptly at ${c.supportEmail} if you believe your account has been used without your permission.`,
        "You may delete your account at any time from Profile, then Privacy and data, then Delete my account. Deletion is permanent: it removes your account and the data stored for it on our servers, and it cannot be undone.",
      ],
    },
    {
      id: "your-content",
      heading: "Your photos and information",
      body: [
        "You keep ownership of the photos and information you submit. You confirm that they are yours, or that you are authorized to provide them, and that submitting them does not infringe anyone else's rights.",
        "You grant us permission to process your photos and information only as needed to operate, secure, and support the Service for you, and only as described in the Privacy Notice. We do not sell personal information, and we do not use face photos or derived skin information to train models without a separate, explicit opt-in.",
      ],
    },
    {
      id: "acceptable-use",
      heading: "Acceptable use",
      body: [
        "Use the Service for your own skincare, honestly and lawfully. In particular, you agree not to:",
      ],
      bullets: [
        "upload another person's photos without their permission, or photos of anyone under the minimum age",
        "bypass, script, or otherwise interfere with scan-quality checks, usage limits, quotas, or paywalls",
        "probe, scan, overload, or disrupt the Service or the infrastructure it runs on",
        "reverse engineer, scrape, or resell the Service or its output, or use it to build a competing product",
        "submit unlawful, infringing, harassing, or deliberately misleading content",
        "present Pore output as professional medical advice, or as your own clinical assessment of another person",
        "use the Service to make decisions about another person's employment, insurance, credit, or care",
      ],
    },
    {
      id: "availability",
      heading: "Availability and changes to the Service",
      body: [
        "Features may change, fail, or be withdrawn, and analysis capacity is limited and metered. We may restrict or suspend access when needed for safety, security, cost control, or reliability.",
        "When a scan cannot be analyzed, the Service tells you so plainly. We will not silently substitute a cached, sample, or fabricated result for a real one.",
        "Back up anything you need to keep. Local app data lives on your device, and it is lost if you delete the app without an account.",
      ],
    },
    {
      id: "purchases",
      heading: "Purchases and subscriptions",
      body: [
        "Paid features are optional, and the core routine remains available without paying. Where paid plans are offered, the final localized price, billing period, and renewal terms are shown before checkout, and purchases are processed by the app store on your platform under its own terms and refund policy.",
        "Subscriptions renew until cancelled, and you cancel through your app store account settings rather than through us. Anyone under 18 must have a parent or guardian take the checkout action; privacy or photo authorization is not permission to purchase.",
      ],
    },
    {
      id: "intellectual-property",
      heading: "Our intellectual property",
      body: [
        `The Service, including its software, design, text, brand, and the structure of its guidance, belongs to ${legalValue(c.legalEntityName)} or its licensors and is protected by intellectual property law. These Terms grant you a personal, limited, non-exclusive, non-transferable, revocable licence to use the Service for your own skincare, and nothing more.`,
        "You may keep and share your own results and routines. You may not use our name or brand to imply endorsement without written permission.",
      ],
    },
    {
      id: "third-parties",
      heading: "Third-party services",
      body: [
        "The Service depends on third parties, including Anthropic for AI analysis, Supabase for accounts and storage, and Vercel for hosting. Their availability and behavior are outside our control, and their handling of data is described in the Privacy Notice.",
        "Product information and links to retailers are provided for convenience. We do not sell products, we do not guarantee that any product is in stock or accurately priced, and a purchase you make elsewhere is between you and that seller.",
      ],
    },
    {
      id: "privacy",
      heading: "Privacy",
      body: [
        "The Privacy Notice explains what the Service collects, why, who processes it, how long it is kept, and how to delete it. It is part of these Terms, and it is readable inside the app without a network connection.",
      ],
    },
    {
      id: "disclaimers",
      heading: "Disclaimers",
      body: [
        'To the fullest extent permitted by law, the Service is provided "as is" and "as available", without warranties of any kind, whether express, implied, or statutory, including implied warranties of merchantability, fitness for a particular purpose, accuracy, and non-infringement.',
        "We do not warrant that the Service will be uninterrupted, error-free, or secure, that analysis will be accurate, or that following a suggested routine will improve your skin.",
        "Some jurisdictions do not allow certain warranty exclusions, so parts of this section may not apply to you. Nothing in these Terms limits rights you have under consumer protection law that cannot be waived.",
      ],
    },
    {
      id: "liability",
      heading: "Limitation of liability",
      body: [
        "To the fullest extent permitted by law, we are not liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or for lost profits, lost data, or loss of goodwill, arising out of or relating to your use of the Service.",
        "To the fullest extent permitted by law, our total liability for all claims relating to the Service is limited to the greater of the amount you paid us in the twelve months before the claim arose, or fifty United States dollars.",
        "These limits apply even if a remedy fails its essential purpose. They do not exclude liability that cannot lawfully be excluded, including for fraud, or for death or personal injury caused by negligence.",
      ],
    },
    {
      id: "indemnity",
      heading: "Indemnification",
      body: [
        `You agree to indemnify and hold harmless ${legalValue(c.legalEntityName)} and its officers, employees, and contractors from claims, damages, and reasonable legal costs arising from your misuse of the Service, your breach of these Terms, your violation of law, or content you submitted that you were not entitled to submit.`,
      ],
    },
    {
      id: "termination",
      heading: "Termination",
      body: [
        "You may stop using the Service at any time, and you may delete your data or your account from Profile, then Privacy and data.",
        "We may suspend or end your access if you materially breach these Terms, if we are required to by law, or if continuing would create a safety, security, or cost risk. Where it is reasonable and lawful to do so, we will tell you why and give you a chance to respond.",
        "Sections that by their nature should survive, including ownership, disclaimers, liability limits, indemnification, and governing law, survive termination.",
      ],
    },
    {
      id: "changes",
      heading: "Changes to these terms",
      body: [
        "We may update these Terms as the Service changes. The current version always carries an effective date and a last-updated date at the top.",
        "For material changes, particularly new paid features or new uses of sensitive data such as face photos, we will present the change before it applies to you, and where consent is required we will ask for it again rather than assuming it. Continuing to use the Service after a change takes effect means you accept the updated Terms.",
      ],
    },
    {
      id: "governing-law",
      heading: "Governing law and disputes",
      body: [
        `These Terms are governed by the laws of ${legalValue(c.governingLaw)}, without regard to conflict-of-laws rules. The parties submit to the exclusive jurisdiction of ${legalValue(c.disputeVenue)}, except that either party may seek injunctive relief where necessary to protect its intellectual property.`,
        "If you live somewhere whose law gives you the right to bring proceedings locally, or grants you consumer protections that cannot be overridden by agreement, this section does not take those rights away.",
        "Before starting formal proceedings, please contact us. Most problems are faster to fix directly.",
      ],
    },
    {
      id: "general",
      heading: "General",
      body: [
        "If any provision of these Terms is found unenforceable, the rest stays in force, and the unenforceable part is applied as closely as the law allows to its original intent. Our not enforcing a provision is not a waiver of it.",
        "These Terms, together with the Privacy Notice, are the entire agreement between you and us about the Service. You may not transfer your rights under them. We may transfer ours as part of a merger, acquisition, or sale of assets, on notice to you.",
      ],
    },
    {
      id: "contact",
      heading: "Contact",
      body: [
        `Questions about these Terms can be sent to ${c.supportEmail}, or raised from Profile, then Learn and support, then Send feedback in the app.`,
        `${legalValue(c.legalEntityName)}, ${legalValue(c.businessAddress)}.`,
      ],
    },
  ],
};
