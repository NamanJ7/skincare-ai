# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Pore — a skincare app that turns guided face photos + an intake questionnaire into a personalized
AM/PM routine. Two clients (marketing/waitlist website + Expo mobile app) share one domain package
that owns the design tokens, the legal copy, the capture-quality measurement, and the deterministic
safety rules governing every routine.

Two things in this product are **code, not prompts**, and that is deliberate: the safety engine
(`packages/shared/src/safety`) and the capture-quality gate (`packages/shared/src/vision`). Both are
unit-tested. Treat model output as a draft that these layers correct.

## Monorepo layout

pnpm workspaces + Turborepo, TypeScript throughout. `.npmrc` sets `node-linker=hoisted` +
`shamefully-hoist=true` — Expo/Metro and Next resolve a flat `node_modules` far more reliably than
pnpm's symlinked store. Don't "fix" that back to symlinks.

- `apps/web` — Next.js 16 (App Router, React 19) marketing site + waitlist + the `/api/plan`
  pipeline endpoint. Tailwind v4.
- `apps/mobile` — Expo SDK 56 / React Native 0.85, Expo Router. Has its own `AGENTS.md` (imported by
  its `CLAUDE.md` via `@AGENTS.md`) — **read it before touching Expo code**: Expo has changed
  recently enough that you must check the versioned docs at
  https://docs.expo.dev/versions/v56.0.0/ before writing anything, not rely on training knowledge.
  `metro.config.js` is monorepo-aware (watches the workspace root, resolves the hoisted store) —
  keep it that way.
- `packages/shared` (`@pore/shared`) — the single source of truth consumed by both apps. Ships TS
  source, not a build; `apps/web/next.config.ts` lists it in `transpilePackages`. Subpath exports:
  `.`, `./design`, `./safety`, `./types`, `./legal` (note: **no** `./vision` subpath — vision is
  re-exported from the root barrel only).
  - `design/` — color/spacing/radius/typography/shadow tokens (`tokens.ts`) plus a Tailwind preset.
  - `types/` — the domain model (`IntakeResponse`, `Routine`/`RoutineStep`, `Assessment`,
    `PhotoQuality`, product types).
  - `safety/` — `applySafetyRules`, the deterministic routine-safety engine, and the `ACTIVES`
    ingredient metadata table + `activeRelevanceScore` it runs against.
  - `vision/` — `scoreFrame` / `captureHint` / `CAPTURE_TUNING`, the pure-maths capture-quality
    measurement. No I/O lives here on purpose, so vitest can cover it.
  - `legal/` — the privacy policy and terms **as data** (`PRIVACY_POLICY`, `TERMS_OF_USE`,
    `LEGAL_DOCUMENTS`, `MEDICAL_DISCLAIMER`, `LEGAL_CONTACT_EMAIL`, `LEGAL_LAST_UPDATED`), so web and
    mobile render byte-identical text.

Also at the root: `TODOS.md` — deferred work that is real, including thresholds that must be tuned
on hardware before launch. It is treated as authoritative ("if it is not written here, it does not
exist"). Update it when you finish or defer something.

## Commands

Run from the repo root (Turborepo fans out per package; pnpm workspaces link `@pore/shared`).

```bash
pnpm install          # install everything

pnpm build            # turbo run build     (web only defines `build`; mobile/shared have none)
pnpm dev              # turbo run dev       (persistent, uncached)
pnpm lint             # turbo run lint      (web only; eslint-config-next flat config)
pnpm typecheck        # turbo run typecheck (all three packages: tsc --noEmit)
pnpm test             # turbo run test      (packages/shared only, via vitest)
```

Single-package / single-test invocations:

```bash
# shared package
pnpm --filter @pore/shared test              # vitest run
pnpm --filter @pore/shared test:watch        # vitest watch mode
pnpm --filter @pore/shared exec vitest run src/safety/engine.test.ts
pnpm --filter @pore/shared exec vitest run src/vision/quality.test.ts
pnpm --filter @pore/shared typecheck

# web
pnpm --filter web dev                        # next dev, http://localhost:3000
pnpm --filter web lint
pnpm --filter web build

# mobile (run from apps/mobile, or pnpm --filter @pore/mobile <script>)
pnpm --filter @pore/mobile start             # expo start
pnpm --filter @pore/mobile ios / android / web
pnpm --filter @pore/mobile typecheck
```

Current baseline (keep it here): `pnpm test` → 2 files, 27 tests, all passing. `pnpm typecheck` →
clean in all three packages. `pnpm lint` → 0 errors, 6 pre-existing `no-unused-vars` warnings
(`components/ui/Button.tsx`, `lib/mock.ts`). Don't let a change add errors; the warnings are known.

`packages/shared` is the only package with tests. `apps/web` and `apps/mobile` have none — notably
the `/api/plan` input validation, which is a trust boundary in front of a paid endpoint (tracked in
`TODOS.md`).

## Architecture: the plan-generation pipeline

`apps/web/lib/pipeline.ts` (`generatePlan`, server-only) is the core flow, hit via
`POST /api/plan` (`apps/web/app/api/plan/route.ts`, Node runtime — the Anthropic SDK needs Node,
not edge — with `maxDuration: 60` since it makes two model calls).

**The route is a trust boundary and is explicit about it.** `validateImages` caps the request at 3
images and ~8MB decoded each, rejects `data:` URI prefixes, allowlists media types, and parses
client-supplied `quality` through `PhotoQualitySchema` rather than trusting it. Each rule returns
its own message — "invalid request" tells a legitimate client nothing. Keep that property.

1. **Vision assessment** — up to 3 photos + intake JSON go to Claude (`client.messages.parse` with a
   Zod `output_config.format`, model `claude-opus-4-8`) using `ASSESSMENT_SYSTEM`, producing a
   structured, explicitly *cosmetic-not-diagnostic* `Assessment`. Every image is preceded by a text
   block naming its **angle, illuminant and measured quality score** — handing the model three
   anonymous photos is how a finding ends up attached to the wrong side of a face. The prompt
   requires `overallConfidence` to fall and `limitations` to be populated when photos arrive flagged
   or an angle is missing.
2. **Routine draft** — the assessment + intake go to Claude again with `ROUTINE_SYSTEM`, producing a
   draft `Routine` (also schema-constrained), normalized by `normalizeDraft`.
3. **Deterministic safety clamp** — `applySafetyRules` (`packages/shared/src/safety/engine.ts`)
   post-processes the draft and guarantees the invariants no matter what the model returns. Applied
   in this order (order matters — allergy/pregnancy removals happen before the caps count actives):
   1. User-listed allergens are removed.
   2. Pregnancy/breastfeeding strips `avoid` actives and flags `caution` ones.
   3. Duplicate actives within one session are merged.
   4. Retinoid frequency is clamped to a slow starting cadence (2x/week if sensitivity is high, else
      3x/week), adding a `rampSchedule` if the draft had none.
   5. At most one strong exfoliating active (acid / retinoid / benzoyl peroxide) per AM/PM session —
      extras move to the other session if it's free, otherwise they're dropped. PM is capped before
      AM.
   6. Sensitivity caps the total distinct strong actives across the whole routine (low: 3, medium: 2,
      high: 1) — lowest `activeRelevanceScore` against the user's goals is dropped first, harsher
      first on ties.
   7. Sunscreen is always present in the AM routine (appended if missing).

   Every adjustment is recorded as a `SafetyAdjustment` (`rule`, `action`, `active?`, `time?`,
   `detail`) returned alongside the routine — this audit trail is what the UI shows the user as "why
   we changed X", so `detail` strings are user-facing copy. When editing safety behavior, add/extend
   cases in `packages/shared/src/safety/engine.test.ts` rather than only eyeballing output.
4. When `ANTHROPIC_API_KEY` is unset, `generatePlan` skips both Claude calls entirely and uses a
   deterministic mock (`apps/web/lib/mock.ts`) fed through the *same* safety engine, so the full flow
   (including safety adjustments) works end-to-end without a key. The mock draft is deliberately
   over-loaded (two acids at night, a daily retinoid, no SPF) so the engine has visible work to do,
   and it mirrors the real pipeline's honesty rules — a missing angle or flagged shot costs
   confidence there too. **Preserve this fallback when changing the pipeline.**

The mobile app calls the same endpoint via `apps/mobile/src/lib/api.ts` (`fetchPlan`), pointed at
`EXPO_PUBLIC_API_URL` (e.g. your dev machine's LAN IP). If that's unset or the request fails,
`fetchPlan` returns `null` and `today.tsx` falls back to running its own local draft through
`applySafetyRules` rather than erroring — so the app always shows a real, safety-clamped routine.

## Architecture: guided capture (the other half)

`packages/shared/src/vision/quality.ts` + `apps/mobile/src/lib/photoQuality.ts` +
`apps/mobile/src/app/onboarding/photo.tsx`. The camera is treated as an instrument: every frame is
measured before it is allowed to become an assessment, and what was measured travels with the photo
so the model can lower its own confidence instead of guessing confidently.

- `scoreFrame(px, w, h, tone)` is pure maths over an RGBA buffer, returning a 0..1 composite,
  `PhotoQualityFlag[]` (`dark` | `bright` | `blurry` | `uneven_light` | `color_cast` | `too_far`),
  the raw metrics, and a gray-world `illuminant` estimate. `captureHint(flags)` returns **one**
  fixable instruction, never a list.
- **Exposure floors are per skin tone** (`TONE_PROFILE`), and skin detection has deliberately **no
  luma gate**. A single fixed exposure floor tells darker-skinned users their perfectly good photo is
  "too dark", over and over — that's the documented bias shape in this category, and
  `quality.test.ts` locks in the regression (a correctly exposed deep-skin capture must not be
  flagged `dark`). Do not add a luma gate or collapse the tone profile to one row.
- Tone-independent thresholds live in one exported `CAPTURE_TUNING` object on purpose. They are
  seeded from theory, **not** from this product's camera, and must be tuned on real device captures
  across the full tone range before launch (see `TODOS.md`).
- The mobile side crops a centre region at near-native resolution **before** downscaling to 256px.
  Resizing a 12MP frame straight down destroys the high-frequency detail that sharpness is measured
  from, and every photo would score blurry. Keep crop-then-resize.
- Delivery photos are resized to 1280px / 0.75 JPEG: Claude downsamples vision inputs to a ~1568px
  max edge, so anything larger is bytes burned for no resolution gain.
- After two rejected attempts on the same angle there's an escape hatch that forces the photo
  through — the flags still travel with it, so the model lowers its own confidence rather than the
  app pretending the shot was fine.

### On-device photo storage (`apps/mobile/src/lib/photos.ts`)

Photos live in the app's document directory and are **never uploaded to storage**; the base64 copy
exists only for the duration of one `/api/plan` request. Layout:

```
<documents>/skin-photos/
  sessions.json                 # { version: 1, sessions: [{ id, capturedAt }] }  — append-only index
  <sessionId>/                  # sessionId = ISO timestamp with : and . replaced by -
    front.jpg  left.jpg  right.jpg
    manifest.json               # { version, id, capturedAt, photos: [{ angle, capturedAt, quality }] }
```

Each session gets its own folder so an earlier visit survives a later one — that history is what the
comparison view and the ghost-alignment overlay need. **Do not change this schema without accounting
for `compare.tsx`, `sessionPhotoUri`, `listSessions`, `storedPhotoCount` and `deleteStoredPhotos`.**
All storage writes are best-effort: a failure degrades to "not kept for later", never to a failed
capture.

## Mobile app

Expo Router, file-based under `apps/mobile/src/app`. `@/*` maps to `src/*`, `@/assets/*` to
`assets/*`.

```
index.tsx              splash animation -> landing -> sign-up / sign-in
(auth)/sign-up|sign-in  STUB: no backend. Any valid-looking input routes on. Real auth is a later increment.
onboarding/age         age gate; <16 blocked, <=17 detours through consent
onboarding/consent     parental-consent email capture (records the address; does not yet verify)
onboarding/photo       guided 3-angle capture (the big one — ~420 lines, single screen, shared camera mount)
onboarding/intake      questionnaire; calls fetchPlan at the end
today.tsx              the routine + assessment + safety-adjustment UI, "Your photos" privacy row
compare.tsx            newest session vs the one before it, one angle at a time
legal/privacy|terms    render the shared LegalDocument
```

Flow ordering is **photo-first**: capture comes before the questionnaire (it's the moment someone
decides the product is real), but plan generation waits until the end of intake so the assessment
runs on real answers rather than defaults. Skin tone is asked during capture, where it visibly
calibrates the camera, not as one more anonymous questionnaire step.

- **Styling: no NativeWind.** Despite the name, mobile uses React Native `StyleSheet` plus the small
  UI kit in `apps/mobile/src/theme/ui.tsx` (`AppText`, `Screen`, `Card`, `PrimaryButton`,
  `GhostButton`, `Chip`, `ProgressDots`, `TextField`, `Divider`). `apps/mobile/src/theme/index.ts`
  re-exports the shared tokens alongside it, so `import { AppText, colors, spacing } from "@/theme"`
  is the one import for both. `src/global.css` is a leftover CSS-variable file, not a Tailwind entry.
- **Fonts**: React Native can't synthesize weights from one custom family, so `theme/fonts.ts` loads
  8 weight-specific `@expo-google-fonts` faces (deep imports, so Metro bundles only those) and
  `resolveFontFamily(family, weight)` picks the right face. The root layout holds the native splash
  up until fonts are ready.
- **State**: `src/state/onboarding.tsx` is a single in-memory React context (`OnboardingProvider` /
  `useOnboarding`) carrying `Partial<IntakeResponse>` + `parentEmail` + `photos` + the generated
  `plan`. There is no persistence layer yet — the only durable state on device is the photo store.
- `src/lib/intake.ts` (`buildIntake`) fills an `IntakeResponse` from partial onboarding answers with
  sensible defaults, including defaulting `darkMarkProne` from skin tone rather than assuming it of
  everyone.
- `app.json` config worth knowing: `expo-updates` is enabled with a fingerprint runtime version (JS
  changes can ship without a store review), the camera permission string is user-facing copy, and the
  app is `userInterfaceStyle: "light"` only.

## Web app

Next.js App Router with three route groups:

- `(site)` — marketing: home, features, pricing, blog (+ `[slug]`), contact, privacy, terms.
- `(auth)` — login / signup. **Also stubs**: they show a "launching soon, waitlist members first"
  notice and open the waitlist. Minimal chrome (logo + disclaimer + legal links).
- `api/plan` — the pipeline endpoint above.
- `waitlist/confirmed` — the post-submit landing page.

Content is authored as **typed data, not MDX/CMS**: `lib/blog.ts` (articles as `Block[]`, rendered
by `components/blog/RichText.tsx`), `lib/updates.ts` (the "built in public" feed), `lib/pricing.ts`,
`lib/nav.ts`. This keeps things reliable on Next 16 / Turbopack and maps trivially to a CMS later.

Waitlist is a **Tally** popup: `lib/tally.ts` exposes `openWaitlist()` + the form id; the widget
script is loaded once in `app/layout.tsx`, and the post-submit redirect to `/waitlist/confirmed` is
configured in the Tally dashboard, not in code. There is no waitlist API route in this repo.

## Conventions

- **Structured LLM output** is enforced with Zod schemas via the Anthropic SDK's
  `zodOutputFormat` / `messages.parse` helper, never manual JSON parsing — see `apps/web/lib/schemas.ts`.
  `thinking` is intentionally omitted (see the comment in `pipeline.ts`): `output_config.format`
  already constrains the response to schema-valid JSON, which is the most reliable path for the parse
  helper. The enum members in `schemas.ts` mirror `@pore/shared/types` by hand — **keep them in
  sync** when you add an active, category, concern or flag.
- **Design tokens live only in `packages/shared/src/design/tokens.ts`.** Never hardcode a hex or size
  anywhere else. Mobile imports them directly through `@/theme`. Web is the exception to know about:
  `apps/web/app/globals.css` restates the same values in a Tailwind v4 `@theme` block, so a token
  change means editing **both files**. `tailwindPreset` (`design/tailwind-preset.ts`) is exported but
  currently consumed by nobody — it's a Tailwind v3-shaped preset left over from the NativeWind plan.
  Don't assume changing it affects either client.
- **Legal copy is legal text.** `packages/shared/src/legal/content.ts` reproduces the pre-launch
  wording verbatim; sentences marked "Disclosure" state facts about how the deployed site actually
  behaves, verified against the code. Restructure freely, **reword never**, and bump
  `LEGAL_LAST_UPDATED` whenever any string changes. If the data flow changes (analytics added, a
  second form provider, a real waitlist endpoint), the text must change with it.
- `packages/shared` type modules (`types/*.ts`) export types only (`export type *` from the barrel).
  Keep new domain types type-only unless they need runtime values; `safety/`, `vision/`, `design/`
  and `legal/` are where runtime values belong.
- `tsconfig.base.json` is strict and then some: `noUncheckedIndexedAccess`, `noUnusedLocals`,
  `noUnusedParameters`, `noFallthroughCasesInSwitch`, `isolatedModules`. Expect `!` or explicit
  guards on array indexing in the shared package. Mobile and web extend their own bases
  (`expo/tsconfig.base` and Next's), so shared code is the strictest of the three.
- **Env config**: `apps/web/.env.example` documents `ANTHROPIC_API_KEY` — leave it unset locally to
  exercise the mock pipeline path instead of burning API calls. Mobile reads `EXPO_PUBLIC_API_URL`.
- **Non-diagnostic language is a product invariant, not a style preference.** `AppearanceLevel` tops
  out at `"noticeable"`, concern keys are phrased cosmetically (`acne_like_breakouts`,
  `dark_spot_appearance`), `MEDICAL_DISCLAIMER` ships with every assessment, and
  `escalation.recommendProfessional` is the escape hatch. Don't introduce clinical severity words or
  condition names in copy, prompts, types, or test fixtures.
