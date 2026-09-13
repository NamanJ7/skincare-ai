import { describe, expect, it } from "vitest";

import type { IntakeResponse, Routine } from "@pore/shared";

import {
  MAX_PRODUCT_NAME_LENGTH,
  PRODUCT_CATALOG,
  catalogProductToUserProduct,
  normalizeProductSearchText,
  searchFallbackToUserProduct,
  searchProductCatalog,
} from "./product-catalog";
import { shelfVerdict } from "./shelf";

const emptyRoutine: Routine = { am: [], pm: [], notes: [] };
const intake: IntakeResponse = {
  age: 25,
  goals: ["general_health"],
  skinType: "normal",
  sensitivity: "medium",
  currentProducts: [],
  allergies: [],
  budget: "medium",
  fragrancePreference: "no_preference",
  pregnancyOrBreastfeeding: false,
  skinTone: "medium",
  darkMarkProne: false,
  climate: "temperate",
};

describe("product catalog", () => {
  it("contains 100 complete, uniquely identified products", () => {
    expect(PRODUCT_CATALOG).toHaveLength(100);
    expect(new Set(PRODUCT_CATALOG.map((item) => item.id)).size).toBe(
      PRODUCT_CATALOG.length,
    );
    for (const item of PRODUCT_CATALOG) {
      expect(item.imageId).toBe(item.id);
      expect(item.brand.trim()).not.toBe("");
      expect(item.name.trim()).not.toBe("");
      expect(item.category).toMatch(
        /^(cleanser|moisturizer|sunscreen|serum|toner|other)$/,
      );
      expect(Array.isArray(item.keyActives)).toBe(true);
    }
  });
});

describe("searchProductCatalog", () => {
  it("normalizes punctuation, accents, capitalization, and whitespace", () => {
    expect(normalizeProductSearchText("  LA ROCHE–POSAY  ")).toBe(
      "la roche posay",
    );
    expect(searchProductCatalog("LA ROCHE POSAY hyalu")[0]?.id).toBe(
      "lrp-hyalu-b5-serum",
    );
  });

  it("matches brand and product terms in any order", () => {
    expect(searchProductCatalog("niacinamide ordinary")[0]?.id).toBe(
      "ordinary-niacinamide-10-zinc-1",
    );
  });

  it("matches categories, ingredient synonyms, aliases, and partial terms", () => {
    expect(
      searchProductCatalog("cerave moisturiser").map((item) => item.brand),
    ).toContain("CeraVe");
    expect(searchProductCatalog("adapalene")[0]?.id).toBe(
      "differin-adapalene-gel",
    );
    expect(searchProductCatalog("buffet")[0]?.id).toBe(
      "ordinary-multi-peptide-ha",
    );
    expect(searchProductCatalog("panox benz")[0]?.brand).toBe("PanOxyl");
    expect(searchProductCatalog("lrp anthelios")[0]?.brand).toBe(
      "La Roche-Posay",
    );
  });

  it("returns no result for short or unmatched queries", () => {
    expect(searchProductCatalog("a")).toEqual([]);
    expect(searchProductCatalog("totally unknown jar 123")).toEqual([]);
  });
});

describe("catalog-to-user-product mapping", () => {
  it("autofills display name, category, actives, and metadata without sharing arrays", () => {
    const item = PRODUCT_CATALOG.find(
      (candidate) => candidate.id === "cerave-resurfacing-retinol-serum",
    );
    expect(item).toBeDefined();
    const mapped = catalogProductToUserProduct(item!, {
      id: "product-1",
      addedAt: "2026-07-14T12:00:00.000Z",
    });

    expect(mapped).toEqual({
      id: "product-1",
      catalogId: "cerave-resurfacing-retinol-serum",
      name: "CeraVe Resurfacing Retinol Serum",
      category: "serum",
      actives: ["retinoid", "ceramides", "hyaluronic_acid", "niacinamide"],
      addedAt: "2026-07-14T12:00:00.000Z",
    });
    expect(mapped.actives).not.toBe(item!.keyActives);
  });

  it("does not invent actives or an ingredients-unknown answer for a known catalog item", () => {
    const item = PRODUCT_CATALOG.find(
      (candidate) => candidate.id === "supergoop-unseen-sunscreen",
    );
    const mapped = catalogProductToUserProduct(item!, { id: "product-2" });

    expect(mapped.actives).toBeUndefined();
    expect(mapped.ingredientsUnknown).toBeUndefined();
    expect(shelfVerdict(mapped, emptyRoutine, intake).status).toBe("unrated");
  });
});

describe("unmatched-search fallback", () => {
  it("creates an editable manual product that remains honestly unrated", () => {
    const fallback = searchFallbackToUserProduct("  My   Mystery Cream  ", {
      id: "product-3",
      addedAt: "2026-07-14T12:00:00.000Z",
    });

    expect(fallback).toEqual({
      id: "product-3",
      name: "My Mystery Cream",
      category: "other",
      ingredientsUnknown: true,
      addedAt: "2026-07-14T12:00:00.000Z",
    });
    expect(shelfVerdict(fallback!, emptyRoutine, intake).status).toBe(
      "unrated",
    );
  });

  it("does not create a blank fallback product", () => {
    expect(
      searchFallbackToUserProduct("   ", { id: "product-4" }),
    ).toBeUndefined();
  });
});

/**
 * A manual product name never reaches the model (src/lib/intake.ts forwards
 * only the enum actives), so there is no prompt-injection path — but it does
 * land in `profiles.onboarding` jsonb, which has no constraint, and is re-synced
 * whole on every profile write. 120 matches the server's `productLength` bound.
 */
describe("manual product name bounds", () => {
  const identity = { id: "user-product-1" };

  it("keeps a normal name intact", () => {
    expect(searchFallbackToUserProduct("CeraVe  Moisturizing   Cream", identity)?.name)
      .toBe("CeraVe Moisturizing Cream");
  });

  it("truncates an over-long query to the cap", () => {
    const product = searchFallbackToUserProduct("z".repeat(10_000), identity);
    expect(product?.name).toHaveLength(MAX_PRODUCT_NAME_LENGTH);
  });

  it("still returns undefined for a whitespace-only query", () => {
    expect(searchFallbackToUserProduct("   ", identity)).toBeUndefined();
  });

  it("marks the fallback as ingredients-unknown so Shelf stays unrated", () => {
    expect(searchFallbackToUserProduct("Some Unknown Cream", identity)).toMatchObject({
      category: "other",
      ingredientsUnknown: true,
    });
  });
});
