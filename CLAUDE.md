# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Pore — a skincare app that turns a face photo + intake questionnaire into a personalized AM/PM
routine. Two clients (marketing/waitlist website + Expo mobile app) share one domain package that
owns the design tokens and the deterministic safety rules governing every routine.

## Monorepo layout

pnpm workspaces + Turborepo, TypeScript throughout.

- `apps/web` — Next.js 16 (App Router) marketing site + waitlist + the `/api/plan` pipeline endpoint.
- `apps/mobile` — Expo (SDK 56) / React Native app, Expo Router, NativeWind. Has its own
  `AGENTS.md` (imported by its `CLAUDE.md` via `@AGENTS.md`) — **read it before touching Expo
  code**: Expo has changed recently enough that you must check the versioned docs at
  https://docs.expo.dev/versions/v56.0.0/ before writing anything, not rely on training knowledge.
- `packages/shared` (`@pore/shared`) — the single source of truth consumed by both apps:
  - `design/` — color/spacing/radius/typography tokens (`tokens.ts`) and a Tailwind preset built
    from them. Never hardcode a hex/size anywhere else in either app; import from here so web and
    mobile stay pixel-consistent.
  - `types/` — the domain model (`IntakeResponse`, `Routine`/`RoutineStep`, `Assessment`, product
    types).
  - `safety/` — `applySafetyRules`, the deterministic routine-safety engine (see below), and the
    `ACTIVES` ingredient metadata table it runs against.

## Commands

Run from the repo root (Turborepo fans out per package; pnpm workspaces link `@pore/shared`).

```bash
pnpm install         # install everything

pnpm build            # turbo run build   (web only defines `build`; mobile has none)
pnpm dev              # turbo run dev     (persistent, uncached)
pnpm lint             # turbo run lint    (web only; eslint-config-next)
pnpm typecheck        # turbo run typecheck (all three packages: tsc --noEmit)
pnpm test             # turbo run test    (packages/shared only, via vitest)
```

Single-package / single-test invocations:

```bash
# shared package
pnpm --filter @pore/shared test              # vitest run
pnpm --filter @pore/shared test:watch        # vitest watch mode
pnpm --filter @pore/shared exec vitest run src/safety/engine.test.ts
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

There is no test suite for `apps/web` or `apps/mobile` today — `packages/shared` is the only
package with tests (vitest), concentrated on the safety engine.

## Architecture: the plan-generation pipeline

`apps/web/lib/pipeline.ts` (`generatePlan`, server-only) is the core flow, hit via
`POST /api/plan` (`apps/web/app/api/plan/route.ts`, Node runtime — the Anthropic SDK needs Node,
not edge — with `maxDuration: 60` since it makes two model calls):

1. **Vision assessment** — up to 3 user photos + intake JSON go to Claude
   (`client.messages.parse` with a Zod `output_config.format`, model `claude-opus-4-8`) using the
   `ASSESSMENT_SYSTEM` prompt, producing a structured, explicitly *cosmetic-not-diagnostic*
   `Assessment`.
2. **Routine draft** — the assessment + intake go to Claude again with `ROUTINE_SYSTEM`, producing
   a draft `Routine` (also schema-constrained via Zod).
3. **Deterministic safety clamp** — `applySafetyRules` (`packages/shared/src/safety/engine.ts`)
   post-processes the draft. This is the part of the product that is code, not a prompt, and it
   guarantees invariants no matter what the model returns:
   - Sunscreen is always present in the AM routine.
   - Pregnancy/breastfeeding strips "avoid" actives and flags "caution" ones.
   - User-listed allergens are removed.
   - Retinoid frequency is clamped to a slow starting cadence (2x/week if sensitivity is high, else
     3x/week).
   - At most one strong exfoliating active (acid/retinoid/benzoyl peroxide) per AM/PM session —
     extras are moved to the other session if it's free, otherwise dropped.
   - Sensitivity level caps the total number of distinct strong actives across the whole routine
     (low: 3, medium: 2, high: 1) — the lowest-relevance-to-goals actives are dropped first.
   - Duplicate actives within one session are merged.

   Every adjustment the engine makes is recorded as a `SafetyAdjustment` (rule id, action, detail)
   returned alongside the routine — this audit trail is what the UI shows the user as "why we
   changed X". When editing safety behavior, add/extend cases in
   `packages/shared/src/safety/engine.test.ts` rather than only eyeballing output.
4. When `ANTHROPIC_API_KEY` is unset, `generatePlan` skips both Claude calls entirely and uses a
   deterministic mock (`apps/web/lib/mock.ts`) fed through the *same* safety engine, so the full
   flow (including safety adjustments) works end-to-end without a key. Preserve this fallback when
   changing the pipeline.

The mobile app calls the same endpoint via `apps/mobile/src/lib/api.ts` (`fetchPlan`), pointed at
`EXPO_PUBLIC_API_URL`. It returns a `PlanOutcome` that keeps "no server configured" and "the
request failed" apart: the first falls back to the local safety-engine demo (labelled as one on
`/today`), the second stops on the intake screen with a retry. Never collapse those two — showing
someone an example routine as though it were a read of their face is the one failure this app
must not have.

## Persistence

There is no backend and no user accounts. Everything the app remembers lives in its own document
directory, written as versioned JSON with failures treated as non-fatal:

- `apps/mobile/src/lib/photos.ts` — `skin-photos/<sessionId>/` (three JPEGs + `manifest.json`) and
  a top-level `sessions.json` index.
- `apps/mobile/src/lib/plan.ts` — `check-ins/<sessionId>.json`, one record per visit holding that
  visit's `IntakeResponse` and `PlanResult`. The key is the **same `sessionId` the photos are
  stored under**: findings and pixels from one visit have to be able to find each other, and that
  link is what makes progress comparison possible. `loadPlan()` returns the newest and
  `OnboardingProvider` calls it synchronously on mount, which is what lets `app/index.tsx` route a
  returning user straight to `/today` on its first render.

There is deliberately **no index file** for check-ins. `newSessionId()` is an ISO timestamp with
`:` and `.` replaced, so filenames sort lexically and the directory listing is the index. This
avoids the failure mode `sessions.json` already has, where a session can exist on disk while the
index append that should have announced it failed.

Three rules here are load-bearing. Photo base64 is never written to disk — it exists for the
duration of one `/api/plan` request, and the privacy copy in `packages/shared/src/legal/content.ts`
depends on that staying true. Records live in `check-ins/`, never inside `skin-photos/`, because
`deleteStoredPhotos()` deletes that whole tree and the app promises deleting your photos leaves
your routine alone. And the readers return null on anything they cannot fully verify: this runs on
the launch path, so a half-read plan would either crash every start or put the wrong findings in
front of the user. Changing the record schema means bumping `VERSION` **and** extending
`migrateLegacyPlan` — a version bump alone silently discards every existing user's routine.

## Progress comparison

`packages/shared/src/progress/compareAssessments` diffs two check-ins' `Assessment`s. Like the
safety engine, it is code rather than a prompt: a comparison that answers differently each run
cannot be tested or explained, and this one produces a sentence about someone's face.

It is built to refuse. It returns `comparable: false` with no changes at all when the check-ins
are under 28 days apart, were not both shot under `screen_flash` (the only illuminant that is
comparable across sessions), or when either read was below 0.5 `overallConfidence`; and it marks
individual concerns `"unclear"` rather than guessing when a finding is missing or low-confidence.
Vocabulary is `less_visible`/`more_visible`, never "improved"/"worse" — the app describes
appearance and does not grade the user. Deliberately do **not** feed a previous assessment into
the next vision call to get this: the model would anchor on its own prior answer and report
continuity that isn't there, which looks like signal and isn't.

The 28-day floor is shared with `apps/mobile/src/lib/checkin.ts`, which drives the re-scan prompt
on `/today` — prompting sooner would invite a comparison the engine then declines to make.

## Conventions

- Structured LLM output is enforced with Zod schemas via the Anthropic SDK's
  `zodOutputFormat`/`messages.parse` helper, not manual JSON parsing — see `apps/web/lib/schemas.ts`
  and `pipeline.ts`'s comment on why `thinking` is intentionally omitted (schema-constrained output
  is already the reliable path).
- Design tokens live only in `packages/shared/src/design/tokens.ts`; web consumes them through the
  generated Tailwind preset, mobile through `apps/mobile/src/theme` (which re-exports the same
  tokens and maps font family + weight to the specific `@expo-google-fonts` face name).
- `packages/shared` type modules (`types/*.ts`) export types only (`export type *` from the barrel)
  — keep new domain types type-only unless they need runtime values.
- Env config: `apps/web/.env.example` documents `ANTHROPIC_API_KEY`; unset it locally to exercise
  the mock pipeline path instead of burning API calls.
