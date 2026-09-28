/** Curated product catalog + the recommendations attached to routine steps. */
import type { ActiveKey, ProductCategory } from "./routine";

export type PriceTier = "budget" | "mid" | "premium";

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: ProductCategory;
  actives: ActiveKey[];
  priceTier: PriceTier;
  fragranceFree: boolean;
  /** Vetted as suitable for sensitive skin. */
  sensitiveSafe: boolean;
  /** ISO region codes where this is readily available, e.g. ["US", "CA"]. */
  regions: string[];
  /** Affiliate/retail link, surfaced transparently. */
  url?: string;
}

/** The recommendation set shown for a single routine step. */
export interface StepRecommendation {
  /** Index into the routine's AM or PM step list. */
  stepOrder: number;
  time: "AM" | "PM";
  bestMatch: Product;
  budget?: Product;
  sensitive?: Product;
  /** True when the user already owns a product covering this step. */
  alreadyOwned?: boolean;
  /** Plain-language explanation of why this product fits. */
  why: string;
}
