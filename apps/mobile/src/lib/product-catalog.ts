/**
 * Product Search Lite's on-device catalog.
 *
 * Curated in July 2026 from current Ulta, Sephora, Dermstore, and official
 * brand bestseller/product pages. `keyActives` is intentionally narrower than
 * a full ingredient list: only actives supported by Pore's deterministic
 * safety engine are tagged. Formulas change, so an empty list must remain
 * unrated rather than being treated as compatible.
 */
import { ACTIVES, type ActiveKey } from "@pore/shared";

import type { UserProduct, UserProductCategory } from "./profile";

export interface CatalogProduct {
  id: string;
  /** Key into the bundled product thumbnail map. */
  imageId: string;
  brand: string;
  name: string;
  category: UserProductCategory;
  keyActives: readonly ActiveKey[];
  notes?: string;
  /** Common abbreviations or former names that make local matching friendlier. */
  aliases?: readonly string[];
}

function product(
  id: string,
  brand: string,
  name: string,
  category: UserProductCategory,
  keyActives: readonly ActiveKey[] = [],
  notes?: string,
  aliases?: readonly string[],
): CatalogProduct {
  return {
    id,
    imageId: id,
    brand,
    name,
    category,
    keyActives,
    ...(notes ? { notes } : {}),
    ...(aliases ? { aliases } : {}),
  };
}

export const PRODUCT_CATALOG: readonly CatalogProduct[] = [
  // CeraVe
  product(
    "cerave-hydrating-facial-cleanser",
    "CeraVe",
    "Hydrating Facial Cleanser",
    "cleanser",
    ["ceramides", "hyaluronic_acid"],
  ),
  product(
    "cerave-foaming-facial-cleanser",
    "CeraVe",
    "Foaming Facial Cleanser",
    "cleanser",
    ["ceramides", "hyaluronic_acid", "niacinamide"],
  ),
  product(
    "cerave-renewing-sa-cleanser",
    "CeraVe",
    "Renewing SA Cleanser",
    "cleanser",
    ["salicylic_acid", "ceramides", "hyaluronic_acid", "niacinamide"],
    "SA means salicylic acid.",
    ["smoothing cleanser"],
  ),
  product(
    "cerave-acne-foaming-cream-cleanser",
    "CeraVe",
    "Acne Foaming Cream Cleanser 4%",
    "cleanser",
    ["benzoyl_peroxide", "ceramides", "hyaluronic_acid", "niacinamide"],
    "4% benzoyl peroxide.",
  ),
  product(
    "cerave-acne-control-cleanser",
    "CeraVe",
    "Acne Control Cleanser 2%",
    "cleanser",
    ["salicylic_acid", "ceramides", "niacinamide"],
    "2% salicylic acid.",
  ),
  product(
    "cerave-moisturizing-cream",
    "CeraVe",
    "Moisturizing Cream",
    "moisturizer",
    ["ceramides", "hyaluronic_acid"],
    undefined,
    ["moisturising cream", "cream in the tub"],
  ),
  product(
    "cerave-daily-moisturizing-lotion",
    "CeraVe",
    "Daily Moisturizing Lotion",
    "moisturizer",
    ["ceramides", "hyaluronic_acid"],
  ),
  product(
    "cerave-pm-facial-moisturizing-lotion",
    "CeraVe",
    "PM Facial Moisturizing Lotion",
    "moisturizer",
    ["ceramides", "hyaluronic_acid", "niacinamide"],
  ),
  product(
    "cerave-am-facial-moisturizing-lotion-spf-50",
    "CeraVe",
    "AM Facial Moisturizing Lotion SPF 50",
    "sunscreen",
    ["ceramides", "hyaluronic_acid", "niacinamide"],
    undefined,
    ["cerave am spf"],
  ),
  product(
    "cerave-resurfacing-retinol-serum",
    "CeraVe",
    "Resurfacing Retinol Serum",
    "serum",
    ["retinoid", "ceramides", "hyaluronic_acid", "niacinamide"],
  ),

  // La Roche-Posay
  product(
    "lrp-toleriane-hydrating-cleanser",
    "La Roche-Posay",
    "Toleriane Hydrating Gentle Facial Cleanser",
    "cleanser",
    ["ceramides", "niacinamide"],
    undefined,
    ["lrp hydrating cleanser"],
  ),
  product(
    "lrp-toleriane-purifying-cleanser",
    "La Roche-Posay",
    "Toleriane Purifying Foaming Face Wash",
    "cleanser",
    ["ceramides", "niacinamide"],
    undefined,
    ["lrp purifying cleanser"],
  ),
  product(
    "lrp-effaclar-medicated-cleanser",
    "La Roche-Posay",
    "Effaclar Medicated Gel Cleanser",
    "cleanser",
    ["salicylic_acid"],
    "2% salicylic acid.",
    ["effaclar acne wash"],
  ),
  product(
    "lrp-toleriane-double-repair",
    "La Roche-Posay",
    "Toleriane Double Repair Face Moisturizer",
    "moisturizer",
    ["ceramides", "niacinamide"],
  ),
  product(
    "lrp-toleriane-double-repair-uv",
    "La Roche-Posay",
    "Toleriane Double Repair UV SPF 30",
    "sunscreen",
    ["ceramides", "niacinamide"],
  ),
  product(
    "lrp-cicaplast-balm-b5",
    "La Roche-Posay",
    "Cicaplast Balm B5",
    "moisturizer",
    [],
    undefined,
    ["cicaplast baume b5"],
  ),
  product(
    "lrp-anthelios-melt-in-milk-spf-60",
    "La Roche-Posay",
    "Anthelios Melt-In Milk Sunscreen SPF 60",
    "sunscreen",
  ),
  product(
    "lrp-anthelios-ultra-light-fluid-spf-60",
    "La Roche-Posay",
    "Anthelios Ultra Light Fluid Face Sunscreen SPF 60",
    "sunscreen",
    [],
    undefined,
    ["anthelios fluid"],
  ),
  product(
    "lrp-hyalu-b5-serum",
    "La Roche-Posay",
    "Hyalu B5 Pure Hyaluronic Acid Serum",
    "serum",
    ["hyaluronic_acid"],
  ),
  product(
    "lrp-pure-vitamin-c10",
    "La Roche-Posay",
    "Pure Vitamin C10 Serum",
    "serum",
    ["vitamin_c", "salicylic_acid"],
  ),

  // The Ordinary
  product(
    "ordinary-niacinamide-10-zinc-1",
    "The Ordinary",
    "Niacinamide 10% + Zinc 1%",
    "serum",
    ["niacinamide"],
  ),
  product(
    "ordinary-hyaluronic-acid-2-b5",
    "The Ordinary",
    "Hyaluronic Acid 2% + B5 (with Ceramides)",
    "serum",
    ["hyaluronic_acid", "ceramides"],
    undefined,
    ["ha 2 b5"],
  ),
  product(
    "ordinary-glycolic-acid-7-toner",
    "The Ordinary",
    "Glycolic Acid 7% Exfoliating Toner",
    "toner",
    ["glycolic_acid"],
    undefined,
    ["glycolic 7 toning solution"],
  ),
  product(
    "ordinary-lactic-acid-10-ha",
    "The Ordinary",
    "Lactic Acid 10% + HA",
    "serum",
    ["lactic_acid", "hyaluronic_acid"],
  ),
  product(
    "ordinary-mandelic-acid-10-ha",
    "The Ordinary",
    "Mandelic Acid 10% + HA",
    "serum",
    ["mandelic_acid", "hyaluronic_acid"],
  ),
  product(
    "ordinary-salicylic-acid-2",
    "The Ordinary",
    "Salicylic Acid 2% Solution",
    "serum",
    ["salicylic_acid"],
  ),
  product(
    "ordinary-aha-30-bha-2-peel",
    "The Ordinary",
    "AHA 30% + BHA 2% Peeling Solution",
    "serum",
    ["glycolic_acid", "lactic_acid", "salicylic_acid"],
    undefined,
    ["red peel"],
  ),
  product(
    "ordinary-retinol-05-squalane",
    "The Ordinary",
    "Retinol 0.5% in Squalane",
    "serum",
    ["retinoid"],
  ),
  product(
    "ordinary-granactive-retinoid-2",
    "The Ordinary",
    "Granactive Retinoid 2% Emulsion",
    "serum",
    ["retinoid"],
  ),
  product(
    "ordinary-azelaic-acid-10",
    "The Ordinary",
    "Azelaic Acid Suspension 10%",
    "serum",
    ["azelaic_acid"],
  ),
  product(
    "ordinary-natural-moisturizing-factors-ha",
    "The Ordinary",
    "Natural Moisturizing Factors + HA",
    "moisturizer",
    ["hyaluronic_acid"],
    undefined,
    ["nmf ha"],
  ),
  product(
    "ordinary-multi-peptide-ha",
    "The Ordinary",
    "Multi-Peptide + HA Serum",
    "serum",
    ["hyaluronic_acid"],
    "Previously called Buffet.",
    ["buffet"],
  ),

  // Paula's Choice
  product(
    "paulas-choice-2-bha-liquid",
    "Paula's Choice",
    "Skin Perfecting 2% BHA Liquid Exfoliant",
    "toner",
    ["salicylic_acid"],
    undefined,
    ["pc bha liquid"],
  ),
  product(
    "paulas-choice-azelaic-booster",
    "Paula's Choice",
    "10% Azelaic Acid Booster",
    "serum",
    ["azelaic_acid", "salicylic_acid"],
  ),
  product(
    "paulas-choice-c15-booster",
    "Paula's Choice",
    "C15 Super Booster",
    "serum",
    ["vitamin_c"],
  ),
  product(
    "paulas-choice-clinical-retinol",
    "Paula's Choice",
    "Clinical 1% Retinol Treatment",
    "serum",
    ["retinoid"],
  ),
  product(
    "paulas-choice-niacinamide-20",
    "Paula's Choice",
    "Clinical Niacinamide 20% Treatment",
    "serum",
    ["niacinamide"],
  ),
  product(
    "paulas-choice-8-aha-gel",
    "Paula's Choice",
    "Skin Perfecting 8% AHA Gel Exfoliant",
    "serum",
    ["glycolic_acid"],
  ),
  product("paulas-choice-bha-9", "Paula's Choice", "BHA 9 Treatment", "serum", [
    "salicylic_acid",
  ]),
  product(
    "paulas-choice-clear-bp",
    "Paula's Choice",
    "Clear Daily Skin Clearing Treatment 2.5%",
    "serum",
    ["benzoyl_peroxide"],
    "2.5% benzoyl peroxide.",
  ),

  // Neutrogena
  product(
    "neutrogena-hydro-boost-water-gel",
    "Neutrogena",
    "Hydro Boost Water Gel",
    "moisturizer",
    ["hyaluronic_acid"],
  ),
  product(
    "neutrogena-ultra-gentle-cleanser",
    "Neutrogena",
    "Ultra Gentle Daily Cleanser",
    "cleanser",
  ),
  product(
    "neutrogena-oil-free-acne-wash",
    "Neutrogena",
    "Oil-Free Acne Wash",
    "cleanser",
    ["salicylic_acid"],
  ),
  product(
    "neutrogena-stubborn-acne-am",
    "Neutrogena",
    "Stubborn Acne AM Treatment",
    "serum",
    ["benzoyl_peroxide"],
    "2.5% benzoyl peroxide.",
  ),
  product(
    "neutrogena-retinol-pro-night-cream",
    "Neutrogena",
    "Rapid Wrinkle Repair Retinol Pro+ 0.3% Night Cream",
    "moisturizer",
    ["retinoid"],
  ),
  product(
    "neutrogena-clear-face-spf-50",
    "Neutrogena",
    "Clear Face Sunscreen SPF 50",
    "sunscreen",
  ),
  product(
    "neutrogena-hydro-boost-spf-50",
    "Neutrogena",
    "Hydro Boost Water Gel Lotion Sunscreen SPF 50",
    "sunscreen",
    ["hyaluronic_acid"],
  ),

  // Cetaphil
  product(
    "cetaphil-gentle-skin-cleanser",
    "Cetaphil",
    "Gentle Skin Cleanser",
    "cleanser",
    ["niacinamide"],
  ),
  product(
    "cetaphil-daily-facial-cleanser",
    "Cetaphil",
    "Daily Facial Cleanser",
    "cleanser",
    ["niacinamide"],
  ),
  product(
    "cetaphil-moisturizing-cream",
    "Cetaphil",
    "Moisturizing Cream",
    "moisturizer",
    ["niacinamide"],
  ),
  product(
    "cetaphil-daily-oil-free-spf-35",
    "Cetaphil",
    "Daily Oil-Free Facial Moisturizer SPF 35",
    "sunscreen",
    ["hyaluronic_acid"],
  ),
  product(
    "cetaphil-gentle-clear-cleanser",
    "Cetaphil",
    "Gentle Clear Clarifying Acne Cream Cleanser",
    "cleanser",
    ["salicylic_acid"],
    "2% salicylic acid.",
  ),
  product(
    "cetaphil-healthy-radiance-renewing-cream",
    "Cetaphil",
    "Healthy Radiance Renewing Cream",
    "moisturizer",
    ["niacinamide"],
  ),

  // Vanicream
  product(
    "vanicream-gentle-facial-cleanser",
    "Vanicream",
    "Gentle Facial Cleanser",
    "cleanser",
  ),
  product(
    "vanicream-daily-facial-moisturizer",
    "Vanicream",
    "Daily Facial Moisturizer",
    "moisturizer",
    ["ceramides", "hyaluronic_acid"],
  ),
  product(
    "vanicream-moisturizing-cream",
    "Vanicream",
    "Moisturizing Cream",
    "moisturizer",
  ),
  product(
    "vanicream-facial-moisturizer-spf-30",
    "Vanicream",
    "Facial Moisturizer Broad Spectrum SPF 30",
    "sunscreen",
  ),

  // COSRX
  product(
    "cosrx-low-ph-cleanser",
    "COSRX",
    "Low pH Good Morning Gel Cleanser",
    "cleanser",
  ),
  product(
    "cosrx-snail-96-essence",
    "COSRX",
    "Advanced Snail 96 Mucin Power Essence",
    "serum",
    [],
    undefined,
    ["snail mucin essence"],
  ),
  product(
    "cosrx-snail-92-cream",
    "COSRX",
    "Advanced Snail 92 All In One Cream",
    "moisturizer",
    [],
    undefined,
    ["snail cream"],
  ),
  product(
    "cosrx-bha-blackhead-power-liquid",
    "COSRX",
    "BHA Blackhead Power Liquid",
    "toner",
    [],
    "Uses a BHA derivative outside Pore's supported active keys.",
  ),
  product(
    "cosrx-aha-7-whitehead-power-liquid",
    "COSRX",
    "AHA 7 Whitehead Power Liquid",
    "toner",
    ["glycolic_acid"],
  ),
  product(
    "cosrx-niacinamide-15-serum",
    "COSRX",
    "The Niacinamide 15 Serum",
    "serum",
    ["niacinamide"],
  ),

  // Beauty of Joseon
  product(
    "boj-relief-sun",
    "Beauty of Joseon",
    "Relief Sun Rice + Probiotics SPF 50+",
    "sunscreen",
    ["niacinamide"],
    undefined,
    ["boj sunscreen"],
  ),
  product(
    "boj-relief-sun-aqua-fresh",
    "Beauty of Joseon",
    "Relief Sun Aqua-Fresh Rice + B5 SPF 50+",
    "sunscreen",
    ["niacinamide"],
  ),
  product(
    "boj-ginseng-essence-water",
    "Beauty of Joseon",
    "Ginseng Essence Water",
    "toner",
    ["niacinamide"],
  ),
  product(
    "boj-glow-serum",
    "Beauty of Joseon",
    "Glow Serum Propolis + Niacinamide",
    "serum",
    ["niacinamide"],
  ),
  product(
    "boj-revive-eye-serum",
    "Beauty of Joseon",
    "Revive Eye Serum Ginseng + Retinal",
    "serum",
    ["retinoid"],
  ),
  product(
    "boj-green-plum-cleanser",
    "Beauty of Joseon",
    "Green Plum Refreshing Cleanser",
    "cleanser",
  ),

  // Anua and Laneige
  product(
    "anua-heartleaf-cleansing-oil",
    "Anua",
    "Heartleaf Pore Control Cleansing Oil",
    "cleanser",
  ),
  product(
    "anua-heartleaf-77-toner",
    "Anua",
    "Heartleaf 77 Soothing Toner",
    "toner",
  ),
  product(
    "anua-niacinamide-10-txa",
    "Anua",
    "Niacinamide 10 + TXA 4 Serum",
    "serum",
    ["niacinamide"],
    undefined,
    ["anua dark spot serum"],
  ),
  product(
    "laneige-cream-skin",
    "Laneige",
    "Cream Skin Cerapeptide Refiner",
    "toner",
    ["ceramides"],
    undefined,
    ["cream skin toner"],
  ),
  product(
    "laneige-water-bank-blue-ha-cream",
    "Laneige",
    "Water Bank Blue Hyaluronic Cream Moisturizer",
    "moisturizer",
    ["hyaluronic_acid"],
  ),

  // Tatcha
  product(
    "tatcha-dewy-skin-cream",
    "Tatcha",
    "The Dewy Skin Cream",
    "moisturizer",
    ["hyaluronic_acid"],
  ),
  product("tatcha-water-cream", "Tatcha", "The Water Cream", "moisturizer"),
  product("tatcha-rice-wash", "Tatcha", "The Rice Wash", "cleanser"),
  product("tatcha-essence", "Tatcha", "The Essence", "toner"),

  // Glow Recipe
  product(
    "glow-recipe-dew-drops",
    "Glow Recipe",
    "Watermelon Glow Niacinamide Dew Drops",
    "serum",
    ["niacinamide", "hyaluronic_acid"],
  ),
  product(
    "glow-recipe-plum-plump-serum",
    "Glow Recipe",
    "Plum Plump Hyaluronic Serum",
    "serum",
    ["hyaluronic_acid"],
  ),
  product(
    "glow-recipe-plum-plump-cream",
    "Glow Recipe",
    "Plum Plump Hyaluronic Cream",
    "moisturizer",
    ["hyaluronic_acid"],
  ),
  product(
    "glow-recipe-avocado-ceramide-serum",
    "Glow Recipe",
    "Avocado Ceramide Recovery Serum",
    "serum",
    ["ceramides"],
  ),
  product(
    "glow-recipe-strawberry-smooth-serum",
    "Glow Recipe",
    "Strawberry Smooth BHA + AHA Salicylic Serum",
    "serum",
    ["salicylic_acid", "mandelic_acid"],
  ),

  // Drunk Elephant
  product(
    "drunk-elephant-c-firma",
    "Drunk Elephant",
    "C-Firma Fresh Day Serum",
    "serum",
    ["vitamin_c"],
  ),
  product(
    "drunk-elephant-tlc-framboos",
    "Drunk Elephant",
    "T.L.C. Framboos Glycolic Night Serum",
    "serum",
    ["glycolic_acid", "lactic_acid", "salicylic_acid"],
  ),
  product(
    "drunk-elephant-b-hydra",
    "Drunk Elephant",
    "B-Hydra Intensive Hydration Serum",
    "serum",
    ["hyaluronic_acid"],
  ),
  product(
    "drunk-elephant-protini",
    "Drunk Elephant",
    "Protini Polypeptide Cream",
    "moisturizer",
  ),

  // Additional widely sold staples
  product(
    "panoxyl-acne-foaming-wash-10",
    "PanOxyl",
    "Acne Foaming Wash 10%",
    "cleanser",
    ["benzoyl_peroxide"],
    "10% benzoyl peroxide.",
  ),
  product(
    "panoxyl-acne-creamy-wash-4",
    "PanOxyl",
    "Acne Creamy Wash 4%",
    "cleanser",
    ["benzoyl_peroxide"],
    "4% benzoyl peroxide.",
  ),
  product(
    "differin-adapalene-gel",
    "Differin",
    "Adapalene Gel 0.1%",
    "serum",
    ["retinoid"],
    undefined,
    ["differin gel"],
  ),
  product(
    "supergoop-unseen-sunscreen",
    "Supergoop!",
    "Unseen Sunscreen SPF 50",
    "sunscreen",
    [],
    undefined,
    ["super goop unseen"],
  ),
  product(
    "eltamd-uv-clear",
    "EltaMD",
    "UV Clear Broad-Spectrum SPF 46",
    "sunscreen",
    ["niacinamide", "hyaluronic_acid"],
  ),
  product(
    "eltamd-uv-daily",
    "EltaMD",
    "UV Daily Broad-Spectrum SPF 46",
    "sunscreen",
    ["hyaluronic_acid"],
  ),
  product("skinceuticals-ce-ferulic", "SkinCeuticals", "C E Ferulic", "serum", [
    "vitamin_c",
  ]),
  product(
    "skinceuticals-ha-intensifier",
    "SkinCeuticals",
    "Hyaluronic Acid Intensifier Multi-Glycan",
    "serum",
    ["hyaluronic_acid"],
    undefined,
    ["ha intensifier"],
  ),
  product(
    "first-aid-beauty-pure-skin-cleanser",
    "First Aid Beauty",
    "Pure Skin Face Cleanser",
    "cleanser",
    [],
    undefined,
    ["fab cleanser"],
  ),
  product(
    "first-aid-beauty-ultra-repair-cream",
    "First Aid Beauty",
    "Ultra Repair Cream",
    "moisturizer",
    [],
    undefined,
    ["fab ultra repair"],
  ),
  product(
    "kiehls-ultra-facial-cream",
    "Kiehl's",
    "Ultra Facial Cream",
    "moisturizer",
  ),
  product(
    "clinique-moisture-surge-100h",
    "Clinique",
    "Moisture Surge 100H Auto-Replenishing Hydrator",
    "moisturizer",
    ["hyaluronic_acid"],
  ),
  product(
    "bioderma-sensibio-h2o",
    "Bioderma",
    "Sensibio H2O Micellar Water",
    "cleanser",
    [],
    undefined,
    ["bioderma micellar water"],
  ),
];

const CATEGORY_SEARCH_TERMS: Record<UserProductCategory, string> = {
  cleanser: "cleanser cleansing face wash facewash micellar oil balm",
  moisturizer:
    "moisturizer moisturiser moisturizing moisturising cream lotion hydrator",
  sunscreen: "sunscreen sunblock spf uv sun protection",
  serum: "serum treatment exfoliant peel spot treatment",
  toner: "toner essence liquid exfoliant",
  other: "other",
};

const BRAND_SEARCH_TERMS: Record<string, string> = {
  "La Roche-Posay": "lrp la roche posay",
  "Paula's Choice": "pc paulas choice",
  "Beauty of Joseon": "boj beauty joseon",
  "First Aid Beauty": "fab first aid beauty",
  CeraVe: "cera ve",
};

const ACTIVE_SEARCH_TERMS: Record<ActiveKey, string> = {
  salicylic_acid: "salicylic acid bha beta hydroxy acid",
  glycolic_acid: "glycolic acid aha alpha hydroxy acid",
  lactic_acid: "lactic acid aha alpha hydroxy acid",
  mandelic_acid: "mandelic acid aha alpha hydroxy acid",
  benzoyl_peroxide: "benzoyl peroxide bpo bp",
  azelaic_acid: "azelaic acid",
  niacinamide: "niacinamide niacin vitamin b3",
  retinoid: "retinoid retinol retinal retinaldehyde adapalene vitamin a",
  vitamin_c: "vitamin c ascorbic acid ascorbate",
  hydroquinone: "hydroquinone",
  hyaluronic_acid: "hyaluronic acid sodium hyaluronate ha",
  ceramides: "ceramide ceramides",
};

const TOKEN_SYNONYMS: Record<string, string> = {
  moisturiser: "moisturizer",
  moisturising: "moisturizing",
  sunblock: "sunscreen",
};

/** Case-, accent-, punctuation-, and whitespace-insensitive search text. */
export function normalizeProductSearchText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => TOKEN_SYNONYMS[token] ?? token)
    .join(" ");
}

export function catalogProductDisplayName(item: CatalogProduct): string {
  return `${item.brand} ${item.name}`;
}

function productSearchDocument(item: CatalogProduct): string {
  return normalizeProductSearchText(
    [
      catalogProductDisplayName(item),
      item.brand,
      item.name,
      BRAND_SEARCH_TERMS[item.brand] ?? "",
      CATEGORY_SEARCH_TERMS[item.category],
      ...item.keyActives.map(
        (active) => `${ACTIVES[active].label} ${ACTIVE_SEARCH_TERMS[active]}`,
      ),
      ...(item.aliases ?? []),
    ].join(" "),
  );
}

function matchScore(item: CatalogProduct, query: string): number | undefined {
  const display = normalizeProductSearchText(catalogProductDisplayName(item));
  const brand = normalizeProductSearchText(item.brand);
  const name = normalizeProductSearchText(item.name);
  const document = productSearchDocument(item);
  const words = document.split(" ");
  const tokens = query.split(" ");

  if (!tokens.every((token) => words.some((word) => word.includes(token))))
    return undefined;

  let score = 0;
  if (display === query) score += 1_000;
  if (name === query) score += 900;
  if (brand === query) score += 800;
  if (display.startsWith(query)) score += 500;
  if (name.startsWith(query)) score += 400;
  if (brand.startsWith(query)) score += 300;
  if (document.includes(query)) score += 200;

  for (const token of tokens) {
    if (words.includes(token)) score += 30;
    else if (words.some((word) => word.startsWith(token))) score += 20;
    else score += 10;
  }
  return score;
}

/** Ranked local search. A two-character floor avoids noisy one-letter result lists. */
export function searchProductCatalog(
  rawQuery: string,
  limit = 8,
  catalog: readonly CatalogProduct[] = PRODUCT_CATALOG,
): CatalogProduct[] {
  const query = normalizeProductSearchText(rawQuery);
  if (query.length < 2 || limit <= 0) return [];

  return catalog
    .map((item, index) => ({ item, index, score: matchScore(item, query) }))
    .filter(
      (
        match,
      ): match is { item: CatalogProduct; index: number; score: number } =>
        match.score !== undefined,
    )
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map(({ item }) => item);
}

interface UserProductIdentity {
  id: string;
  addedAt?: string;
}

/** Maps a verified catalog selection into the existing Shelf product shape. */
export function catalogProductToUserProduct(
  item: CatalogProduct,
  identity: UserProductIdentity,
): UserProduct {
  const actives = [...new Set(item.keyActives)];
  return {
    id: identity.id,
    catalogId: item.id,
    name: catalogProductDisplayName(item),
    category: item.category,
    ...(actives.length > 0 ? { actives } : {}),
    ...(identity.addedAt ? { addedAt: identity.addedAt } : {}),
  };
}

/**
 * Ceiling for a manually-entered product name. Matches the `productLength`
 * bound the server applies in apps/web/lib/intake-guard.ts — the name itself
 * never reaches the model (src/lib/intake.ts forwards only the enum actives),
 * but it does land in `profiles.onboarding` jsonb, which has no constraint of
 * its own, and it is re-synced whole on every profile write.
 */
export const MAX_PRODUCT_NAME_LENGTH = 120;

/**
 * Turns an unmatched search into an honest manual draft. With no catalog
 * evidence, ingredients are explicitly unknown and Shelf must stay unrated.
 */
export function searchFallbackToUserProduct(
  rawQuery: string,
  identity: UserProductIdentity,
): UserProduct | undefined {
  const name = rawQuery
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_PRODUCT_NAME_LENGTH);
  if (!name) return undefined;
  return {
    id: identity.id,
    name,
    category: "other",
    ingredientsUnknown: true,
    ...(identity.addedAt ? { addedAt: identity.addedAt } : {}),
  };
}
