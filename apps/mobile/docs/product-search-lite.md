# Product Search Lite

## Catalog method

The local catalog is a pragmatic 100-product starter set for a North American
consumer app, not a claim of exact market-share ranking. It was curated on
2026-07-14 using current popularity/bestseller signals from:

- Ulta's best-selling skincare sort:
  https://www.ulta.com/shop/skin-care/all?sort=best_sellers
- Sephora's bestselling skincare collection:
  https://www.sephora.com/beauty/best-selling-skin-care
- Dermstore's bestselling skincare collection:
  https://www.dermstore.com/c/skin-care/bestsellers/
- Current official brand product and bestseller pages, including CeraVe,
  La Roche-Posay, The Ordinary, and Paula's Choice.

The set intentionally spans mass, prestige, and K-beauty products across
cleansers, moisturizers, sunscreens, serums/treatments, and toners. Brand and
product-name matching includes punctuation-insensitive text, common aliases,
category terms, and active synonyms.

## Product images

Every catalog entry has a bundled 320 by 320 thumbnail so search works offline
and does not depend on a third-party image request at runtime. Search results,
the selected-product confirmation, Shelf rows, and matched routine steps use
the same stable `catalogId` to show the exact image.

The image fetch script prioritizes official brand product pages, then uses
retailer product pages and Open Beauty Facts when an official storefront does
not expose a usable package image. It rejects weak name matches, downranks
marketing graphics, and records the source page and source image for all 100
entries in `assets/images/products/sources.json`. The generated contact sheets
support a final visual review of every package image at once.

## Ingredient and rating guardrails

`keyActives` is not a full INCI list. The catalog only tags the 12 active keys
already supported by Pore's deterministic safety engine. If a formula has no
verified supported key, the product maps without actives and Shelf keeps it
`Not rated`. An unmatched search can be copied into manual entry, with
ingredients explicitly marked unknown. Formula copy tells users to check their
own label because manufacturers can reformulate products.

Search analytics never include the query, product name, or brand. Events only
carry flow source, query length, result position, category, and whether the
selection had supported active tags.

Shelf actives are merged into the same deterministic safety input as onboarding
answers. The app rechecks an existing generated plan after Shelf changes and
only places products with a compatible `Earned a spot` or `Use carefully`
verdict into matching routine steps. Unknown products stay `Not rated yet` and
are never inserted into the routine.
