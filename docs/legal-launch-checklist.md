# Legal launch checklist

The Terms of Use and Privacy Notice live in `packages/shared/src/legal/` as
structured data. Both `apps/web` (`/terms`, `/privacy`) and `apps/mobile`
(`/legal/terms`, `/legal/privacy`) render the same objects, so there is exactly
one copy of each document.

## Before launch — needs a human

These values are unknowable from the codebase and are deliberately marked
`pending` in `packages/shared/src/legal/config.ts`. Until they are filled in,
they render in both apps as a visible `[To be completed before launch: …]`
marker rather than as invented text.

| Key | What it needs |
| --- | --- |
| `legalEntityName` | Registered company or sole-proprietor name |
| `businessAddress` | Registered business address |
| `governingLaw` | Governing law (e.g. the Province of Ontario, Canada) |
| `disputeVenue` | Courts with exclusive jurisdiction over disputes |

Run `pendingLegalValues()` to enumerate whatever is still outstanding.
`packages/shared/src/legal/documents.test.ts` asserts the exact set, so filling
one in fails that test until the expectation is updated — which is the reminder.

Also outstanding:

- **`pore.skin` is not a registered domain.** Nothing in the app navigates to it
  any more (that was the bug that sent every legal link to a browser error
  page), but it is still `metadataBase` in `apps/web/app/layout.tsx` and is
  quoted as the public mirror in `config.ts`. Register it or replace it.
- **Professional review.** This copy is written against what the software
  actually does. It is product/legal writing, not legal advice, and it has not
  been reviewed by a lawyer.

## When the implementation changes

The Privacy Notice makes specific factual claims. Whoever changes any of these
owns updating `packages/shared/src/legal/privacy.ts` in the same change:

- **Adding an analytics, error-tracking, or attribution SDK.** The `analytics`
  section currently says there are none, and that the local event outbox has no
  vendor destination configured. Registering a sink via `setAnalyticsSink` makes
  that false.
- **Adding or removing a processor.** The `processors` section lists Anthropic,
  Supabase, Vercel, Tally, and Apple.
- **Changing what the quota rows store.** `collect-automatic` says one row per
  analysis request holding an account id, a salted one-way IP hash, and
  timestamps — never the address itself.
- **Moving anything off-device.** `on-device` claims face detection, capture
  guidance, and the web scan page never upload frames.
- **Shipping payments.** The Terms `purchases` section describes app-store
  billing; entitlements are not yet wired to a real store.

Bump `lastUpdated` (and `effectiveDate` when the change is material) on any
substantive edit. `documents.test.ts` enforces ISO format and
`effectiveDate <= lastUpdated`.

## Route integrity

`apps/mobile/src/lib/legal.test.ts` checks that every legal route resolves to a
real screen file and that no screen hardcodes a `pore.skin` legal URL.
`apps/web/lib/__tests__/nav.test.ts` checks every header/footer/legal href
resolves to a real `page.tsx`. Both would have caught the original bug.
