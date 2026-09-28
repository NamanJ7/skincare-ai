/** Honest, plain-language amount guidance per product category. */
import type { ProductCategory } from "@pore/shared";

export const USAGE: Record<ProductCategory, { amount: string; note: string }> = {
  cleanser: {
    amount: "A dime-sized amount",
    note: "Massage gently with lukewarm water for about 30 seconds, then pat dry.",
  },
  treatment: {
    amount: "A pea-sized amount",
    note: "Apply to dry skin and let it absorb before the next step.",
  },
  serum: {
    amount: "2–3 drops",
    note: "Press into skin after cleansing, before heavier layers.",
  },
  moisturizer: {
    amount: "A nickel-sized amount",
    note: "Apply while skin is still slightly damp to lock in hydration.",
  },
  sunscreen: {
    amount: "Two finger-lengths",
    note: "Cover face and neck. Reapply if you're outside for long stretches.",
  },
  exfoliant: {
    amount: "A thin, even layer",
    note: "Avoid the eye area, and skip other strong actives the same night.",
  },
  spot_treatment: {
    amount: "A small dab",
    note: "Only on the affected spot, not all over.",
  },
};
