/** Honest pre-launch plans. StoreKit becomes the localized price source once
 * purchases are enabled in the iOS app. */

export type PricingCta = "waitlist" | "soon";

export type PricingTier = {
  id: string;
  name: string;
  price: string;
  cadence?: string;
  tagline: string;
  featured?: boolean;
  cta: PricingCta;
  ctaLabel: string;
  features: string[];
};

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    cadence: "always",
    tagline: "Understand your skin and start a routine without paying.",
    cta: "waitlist",
    ctaLabel: "Join Waitlist",
    features: [
      "Initial assessment, scan, and results",
      "Complete first AM / PM routine",
      "Daily routine check-ins and default reminders",
      "3 active compatibility checks each month",
      "First weekly follow-up and comparison",
    ],
  },
  {
    id: "plus",
    name: "Pore Plus",
    price: "US $10.99",
    cadence: "month at launch",
    tagline: "For continued tracking and a routine that adapts with you.",
    featured: true,
    cta: "soon",
    ctaLabel: "Coming Soon",
    features: [
      "Everything in Free",
      "Weekly follow-up scans and progress history",
      "Adaptive weekly reports and routine revisions",
      "Unlimited active compatibility checks",
      "Cross-routine active scheduling",
      "Custom reminder times",
    ],
  },
];

export type ComparisonRow = {
  label: string;
  free: boolean | string;
  plus: boolean | string;
};

export const COMPARISON_ROWS: ComparisonRow[] = [
  { label: "Initial assessment, scan, and results", free: true, plus: true },
  { label: "Complete AM / PM routine", free: true, plus: true },
  { label: "Daily routine check-ins", free: true, plus: true },
  { label: "Default reminders", free: true, plus: true },
  { label: "Active compatibility checks", free: "3 / month", plus: "Unlimited" },
  { label: "Follow-up scan", free: "First weekly", plus: "Every 7 days" },
  { label: "Progress reports", free: "First comparison", plus: "Ongoing" },
  { label: "Adaptive routine revisions", free: false, plus: true },
  { label: "Custom reminder times", free: false, plus: true },
];

export const PRICING_FAQ: { q: string; a: string }[] = [
  {
    q: "When does Pore launch?",
    a: "Pore is preparing an iOS TestFlight beta. Join the waitlist to hear when measured beta access opens.",
  },
  {
    q: "Will the free plan stay free?",
    a: "Yes. Your first assessment, results, routine, default reminders, and first weekly comparison stay available without a subscription.",
  },
  {
    q: "Can pricing change before launch?",
    a: "Yes. US $10.99 per month is the current reference price. The iOS app will always show the localized StoreKit price before a purchase, and beta testers are not charged.",
  },
  {
    q: "Does Pore diagnose or treat skin conditions?",
    a: "No. Pore offers personalized skincare education and routine guidance only. It is not a substitute for professional medical advice, and it encourages seeing a professional when that is the right call.",
  },
  {
    q: "Can I use Pore with products I already own?",
    a: "Absolutely. You build your shelf with what you already use, and Pore works around it, helping you simplify rather than constantly add more.",
  },
];
