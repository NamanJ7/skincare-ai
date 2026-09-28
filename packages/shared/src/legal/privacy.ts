import { LEGAL_CONFIG, legalValue } from "./config";
import type { LegalDocument } from "./types";

const c = LEGAL_CONFIG;

/**
 * Privacy Notice.
 *
 * Every claim here is checked against the implementation, not aspirational.
 * Before editing, verify against: `apps/web/lib/pipeline.ts` (Anthropic),
 * `apps/mobile/src/lib/backend/supabase.ts` (SecureStore session storage),
 * `apps/mobile/src/state/session.tsx` (anonymous auth), `supabase/migrations`
 * (tables, RLS, private bucket, quota rows with a salted IP hash), and
 * `apps/mobile/src/lib/analytics.ts` (the sink is undefined by default).
 *
 * The "no third-party analytics" claim in `analytics` becomes false the day a
 * vendor sink is registered. Whoever wires one up owns updating this document.
 */
export const PRIVACY_NOTICE: LegalDocument = {
  id: "privacy",
  title: "Privacy Notice",
  lede: "A plain-language explanation of what Pore collects, why it is needed, and how you can remove it.",
  effectiveDate: "2026-08-26",
  lastUpdated: "2026-08-26",
  intro: [
    `This notice covers the ${c.productName} mobile app and the ${c.productName} website. It describes what the Service actually does today, not what it might do later.`,
    `${c.productName} is built for people age ${c.minimumAge} and older, with different consent steps for different age groups, and is designed to keep as much as possible on your own device.`,
  ],
  sections: [
    {
      id: "summary",
      heading: "The short version",
      body: [
        "Your profile, routine, check-ins, and scan history are stored on your device. They are only copied to our servers if you create an account, and then only so they can be restored on a new device.",
        "Face photos are never uploaded unless you consent to a scan analysis. When you do, the three photos and your questionnaire answers go to our analysis service and to Anthropic, which processes them to return the result and nothing else.",
        "We do not sell personal information, we run no advertising or tracking, and there are no third-party analytics or tracking SDKs in the app today.",
        "You can delete everything at any time from Profile, then Privacy and data.",
      ],
    },
    {
      id: "youth",
      heading: "Age and youth privacy",
      body: [
        `${c.productName} asks for your exact age in a neutral age screen so it can apply the right privacy flow. People under ${c.minimumAge} are not supported and cannot create a skin profile, submit questionnaire answers, or upload face photos.`,
        "Ages 13 to 15 require authorization from a parent or legal guardian before profile personalization or face-photo analysis is available. The guardian enters a birth year for an adult-age check, attests that they are the parent or legal guardian, and creates a four-digit guardian PIN. The birth year and the PIN itself are not saved: we store a salted one-way digest of the PIN so the same guardian credential can approve later parent-only actions on that device.",
        "This on-device method records adult attestation and verifies the returning credential. It does not independently verify government identity, and we say so plainly rather than implying stronger verification than we perform.",
        "Ages 16 to 17 make their own privacy choice through shorter, teen-readable disclosures. Everyone is asked separately before any face photo is captured. A parent or guardian must handle a paid checkout for anyone under 18.",
      ],
    },
    {
      id: "collect-provided",
      heading: "Information you provide",
      body: [
        "The app can hold your age, skin type and concerns, sensitivity and safety answers such as pregnancy status and ingredient allergies, your current products and routine, goals, check-in entries, reminder preferences, appearance preference, age-tier consent records, and subscription status.",
        "A skin scan contains front, left, and right face photos plus image-quality information about each one. Face photos are sensitive personal information, and we ask for separate consent before any photo is submitted for analysis.",
        "If you create an account, we hold the email address you sign up with, or the private relay identifier Apple gives us when you use Sign in with Apple.",
        "If you send feedback from the app, the message is composed into your own email app and sent by you. We receive whatever you chose to include, and nothing is transmitted from the app itself.",
        "The website waitlist form is operated by Tally and collects the name, email address, and answers you enter there, along with the browser user-agent string of the submission.",
      ],
    },
    {
      id: "collect-automatic",
      heading: "Information collected automatically",
      body: [
        "To meter and protect the paid analysis endpoint, we record one row per analysis request containing your account identifier, a one-way salted hash of your IP address, and timestamps. We do not store the IP address itself, and the hash cannot be reversed back into one.",
        "Our hosting provider processes standard server request data, including IP address, in order to deliver responses and protect the service against abuse.",
        "The app does not use advertising identifiers, and its iOS privacy manifest declares no tracking and no tracking domains.",
      ],
    },
    {
      id: "on-device",
      heading: "What stays on your device",
      body: [
        "Face detection and scan-quality guidance during capture run entirely on your device. The live camera preview is analyzed locally to tell you about lighting, distance, angle, and steadiness. Those preview frames are never uploaded.",
        "On the website scan page, the photos you capture stay in your browser's local storage and are never uploaded. They are cleared when the scan session expires or when you delete them.",
        "Diagnostics you can export from Profile are assembled on your device and shared only if you choose a destination in the share sheet. They contain privacy-safe event history: no photos, no email address, and no skin notes.",
      ],
    },
    {
      id: "use",
      heading: "How the information is used",
      body: [
        "We use this information to generate cosmetic skincare observations, build and adjust a routine, apply the deterministic safety rules, show progress over time, remember your preferences, send the reminders you turn on, operate accounts and backup, protect the service against abuse and runaway cost, and understand whether the product is clear and reliable.",
        "We do not use it to diagnose or treat medical conditions, and we do not make automated decisions about you that produce legal or similarly significant effects.",
        "We do not sell personal information, and we do not use face photos or derived skin information for model training without a separate, explicit opt-in.",
      ],
    },
    {
      id: "processors",
      heading: "Who processes it",
      body: [
        "We use a small number of service providers, each handling data only to perform a task for us:",
      ],
      bullets: [
        "Anthropic — AI processing of scan photos and questionnaire answers, used solely to return the requested cosmetic assessment and routine.",
        "Supabase — accounts and authentication, the database backing up your profile, routine, scans, check-ins, reminders, and entitlements, and private storage for scan photos.",
        "Vercel — hosting for the website and the analysis API.",
        "Tally — the waitlist form on the website, which receives the name, email address, and answers submitted there.",
        "Apple — Sign in with Apple, and app store purchases and subscription status where paid plans are offered.",
      ],
    },
    {
      id: "analytics",
      heading: "Analytics, cookies, and tracking",
      body: [
        "There are no third-party analytics, advertising, or error-tracking SDKs in the app today. The app records product events into a local outbox on your device; no vendor destination is configured, so nothing is transmitted.",
        "We do not use cookies for advertising. The website sets no analytics cookies of its own. The Tally waitlist widget is a third-party embed and is governed by Tally's own privacy practices when you interact with it.",
        "If we ever add an analytics or error-reporting vendor, we will update this notice and this section before it is switched on.",
      ],
    },
    {
      id: "storage",
      heading: "Where it is stored and how it is protected",
      body: [
        "Profile information, routines, check-ins, consent records, reminder preferences, and scan history are stored on your device by default. Devices without an account back nothing up.",
        "If you create an account, that same information is also stored in our Supabase project so it can be restored on a new device, and scan photos may be stored in a private bucket. Database rows and stored photos are protected by owner-only access rules, so one account cannot read another's data, and stored photos have no public URLs.",
        "Sign-in tokens are held in the device keychain or keystore rather than in general app storage, and app files are written with the operating system's file protection enabled.",
        "Network traffic is encrypted in transit. Access to production data is limited to what is needed to operate the service. No system can guarantee absolute security.",
      ],
    },
    {
      id: "retention",
      heading: "How long it is kept",
      body: [
        "Local data stays on your device until you delete a scan, delete your data, or remove the app. Abandoned captures are discarded rather than added to your progress history, and full-resolution scan photos are cleared from the cache when you leave the scan flow.",
        "Account data stays in our database until you delete your account, at which point it is removed along with the account itself.",
        "Analysis metering rows are retained only as long as needed to enforce quotas and investigate abuse. They contain an account identifier, a salted IP hash, and timestamps, and never photo or skin content.",
      ],
    },
    {
      id: "rights",
      heading: "Your choices and rights",
      body: [
        "You can decline photo analysis entirely and use an answers-based routine. You can withdraw future photo-analysis permission at any time from Profile, then Privacy and data, then Photo and privacy controls, and Pore will ask again before any later scan.",
        "Delete my data removes your profile, plan, saved photos, history, reminders, diagnostics, and local subscription status from the device. Delete my account additionally and permanently deletes your account and everything stored for it on our servers.",
        "You can change notification permission in your device settings, and appearance and reminder preferences from Profile.",
        "Depending on where you live, you may have rights to access, correct, port, or delete personal information, to withdraw consent, and to object to or restrict certain processing. The in-app controls exercise most of these directly. A youth or guardian can withdraw authorization by deleting app data.",
        `For any request we cannot fulfil in-app, email ${c.supportEmail}. We honor access and deletion requests by email, and we will not discriminate against you for exercising a privacy right.`,
      ],
    },
    {
      id: "transfers",
      heading: "International transfers",
      body: [
        "Our service providers operate infrastructure in multiple countries, so your information may be processed outside the country you live in. Where required, we rely on the transfer safeguards offered by those providers, such as standard contractual clauses.",
      ],
    },
    {
      id: "changes",
      heading: "Changes to this notice",
      body: [
        "This notice carries an effective date and a last-updated date at the top. Material changes will be dated and presented before new uses of sensitive data take effect, and where consent is required we will ask for it again rather than relying on a previously granted one.",
      ],
    },
    {
      id: "contact",
      heading: "Contact",
      body: [
        `Privacy questions and requests can be sent to ${c.supportEmail}, or raised from Profile, then Learn and support, then Send feedback in the app.`,
        `${legalValue(c.legalEntityName)}, ${legalValue(c.businessAddress)}.`,
      ],
    },
  ],
};
