/** Pricing tiers. Prices are intentionally soft ("Coming soon") pre-launch —
 *  waitlist members get early-access details first. Easy to wire to real
 *  numbers / Stripe later. */

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
    tagline: "For users starting their skincare journey.",
    cta: "waitlist",
    ctaLabel: "Join Waitlist",
    features: [
      "Guided three-photo capture",
      "Personalized AM / PM routine",
      "Deterministic safety clamp",
      "Daily session with paced actives",
    ],
  },
  {
    id: "plus",
    name: "Pore Plus",
    price: "Coming soon",
    tagline: "For deeper tracking and personalized insights.",
    featured: true,
    cta: "soon",
    ctaLabel: "Coming Soon",
    features: [
      "Everything in Free",
      "Advanced compatibility checks",
      "Progress tracking",
      "Routine optimization insights",
      "Personalized product guidance",
    ],
  },
  {
    id: "pro",
    name: "Pore Pro",
    price: "Coming soon",
    tagline: "For the most complete skincare tracking experience.",
    cta: "soon",
    ctaLabel: "Coming Soon",
    features: [
      "Everything in Pore Plus",
      "Advanced skin-progress insights",
      "Expanded routine tracking",
      "Priority access to future AI tools",
      "Early access to new features",
    ],
  },
];

/** Feature comparison matrix for the /pricing page table. */
export type ComparisonRow = {
  label: string;
  free: boolean | string;
  plus: boolean | string;
  pro: boolean | string;
};

export const COMPARISON_ROWS: ComparisonRow[] = [
  { label: "Guided three-photo capture", free: true, plus: true, pro: true },
  { label: "Personalized AM / PM routine", free: true, plus: true, pro: true },
  { label: "Deterministic safety clamp", free: true, plus: true, pro: true },
  { label: "Daily session with paced actives", free: true, plus: true, pro: true },
  { label: "Measured before / after", free: false, plus: true, pro: "Expanded" },
  { label: "Routine adapts to what changed", free: false, plus: true, pro: true },
  { label: "Advanced skin-progress insights", free: false, plus: false, pro: true },
  { label: "Priority access to new AI tools", free: false, plus: false, pro: true },
];

export const PRICING_FAQ: { q: string; a: string }[] = [
  {
    q: "When does Pore launch?",
    a: "Pore is launching as a phone app — the capture needs your screen as a light source, and your photos never leave the device. Join the waitlist and you'll be among the first to get access and early-access pricing details.",
  },
  {
    q: "Will the free plan stay free?",
    a: "Yes. The Free plan is built for anyone starting out — guided capture, a personalized routine, the full safety clamp, and your daily session, with no time limit.",
  },
  {
    q: "Can pricing change before launch?",
    a: "It can. Pricing may be refined before launch, and waitlist members will always receive early-access details and any founding-member offers first.",
  },
  {
    q: "Does Pore diagnose or treat skin conditions?",
    a: "No. Pore offers personalized skincare education and routine guidance only. It is not a substitute for professional medical advice, and it encourages seeing a professional when that's the right call.",
  },
  {
    q: "Does Pore recommend specific products to buy?",
    a: "Not today. Pore tells you which ingredients belong in your routine, how often, and why — then you use whatever you already own that fits. Naming products is something we would rather get right than get out early.",
  },
  {
    q: "Where do my photos go?",
    a: "They stay on your phone. They're sent for your own analysis and never stored on our servers, we never train on them, and you can erase everything from inside the app at any time.",
  },
];
