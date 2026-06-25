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
      "Basic routine builder",
      "Product shelf",
      "Daily AM / PM checklist",
      "Basic ingredient guidance",
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
  { label: "Routine builder", free: true, plus: true, pro: true },
  { label: "Product shelf", free: true, plus: true, pro: true },
  { label: "Daily AM / PM checklist", free: true, plus: true, pro: true },
  { label: "Ingredient guidance", free: "Basic", plus: "Advanced", pro: "Advanced" },
  { label: "Compatibility checks", free: false, plus: true, pro: true },
  { label: "Progress tracking", free: false, plus: true, pro: "Expanded" },
  { label: "Routine optimization insights", free: false, plus: true, pro: true },
  { label: "Personalized product guidance", free: false, plus: true, pro: true },
  { label: "Advanced skin-progress insights", free: false, plus: false, pro: true },
  { label: "Priority access to new AI tools", free: false, plus: false, pro: true },
];

export const PRICING_FAQ: { q: string; a: string }[] = [
  {
    q: "When does Pore launch?",
    a: "Pore is launching soon as a web app, with mobile access on the way. Join the waitlist and you'll be among the first to get access and early-access pricing details.",
  },
  {
    q: "Will the free plan stay free?",
    a: "Yes. The Free plan is built for anyone starting out — a basic routine builder, product shelf, daily checklist, and ingredient guidance, with no time limit.",
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
    q: "Can I use Pore with products I already own?",
    a: "Absolutely. You build your shelf with what you already use, and Pore works around it — helping you simplify rather than constantly add more.",
  },
];
