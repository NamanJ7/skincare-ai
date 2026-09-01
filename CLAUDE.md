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
  - `schedule/` — `planDay`/`planWeek`, the deterministic cadence engine (see below) that turns a
    safety-clamped routine's weekly frequencies into "here is what you do tonight".
  - `progress/` — `compareAssessments`/`adaptRoutine`, the deterministic progress engine (see below)
    that measures whether the routine is working and feeds the answer back into it.

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
`EXPO_PUBLIC_API_URL`; if that's unset or the request fails, it falls back to a local demo rather
than erroring.

## Architecture: the cadence engine

`packages/shared/src/schedule/engine.ts` is the second deterministic layer, and it runs *after*
the safety engine. The safety engine decides what belongs in a routine and how often; this one
decides **which of those steps happen on a given day**, which is the question the user actually
faces. It is the difference between shipping a report and shipping a routine, and — like the
safety engine — it is code, not a prompt:

- Each step's weekly frequency is spread evenly over a 7-day cycle (`spreadDays`), so a 3x/week
  active never lands on consecutive days.
- **At most one strong active per calendar day.** The safety engine caps per *session*; AM acid
  plus PM retinoid still passes that cap and still over-exfoliates. Conflicts are resolved by
  walking the active to the next free day, or dropping it for the cycle if there is none.
- Strong actives **ramp** from a single weekly use to their target frequency over `RAMP_WEEKS`
  (6). Gentle steps and SPF run at full frequency from day one.
- A week only advances the ramp if the user reported nothing worse than `calm` during it. A week
  with no check-ins at all counts as calm — the product asks for feedback, it doesn't punish
  silence.
- A `stinging` report **deloads** the routine for 3 days (two `tight` reports inside 5 days for 2
  days): strong actives are pulled, barrier steps stay.

Every departure from the nominal plan is a `ScheduleNote` with user-facing copy, the same audit
contract as `SafetyAdjustment` — so `/today` can always say *why* tonight looks like this. A
session that renames itself (a "Recovery night") must always carry a note explaining it; a
headline the user can't account for is worse than no headline. Extend
`packages/shared/src/schedule/engine.test.ts` when changing any of this.

State lives in two on-device JSON files, same shape and same promise — synchronous reads,
best-effort writes, nothing uploaded, both disclosed in the privacy content
(`packages/shared/src/legal/content.ts`) and both erasable from `/plan`, which must keep offering
that:

- `apps/mobile/src/lib/journal.ts` — the routine start date, per-session tick-offs, the one-tap
  skin check-ins, the baseline/latest assessments and the adapted routine.
- `apps/mobile/src/lib/profile.ts` — the intake answers and the generated plan.
  **This one is load-bearing for safety.** Sensitivity, the pregnancy flag, declared allergies and
  skin tone are collected once and needed on every launch after that; when they lived in React
  state, a cold start silently re-ran the whole app against `buildIntake({})` defaults, so
  `applySafetyRules` was doing exactly the right thing to the wrong answers and a pregnant user
  could be shown a retinoid. `OnboardingProvider` hydrates from it synchronously before anything
  renders. Base64 photo payloads are never written to it — they exist for one `/api/plan` request.

`apps/mobile/src/lib/reminder.ts` owns the single local daily notification (one per day, hour
chosen by the user, off switch on `/plan`). Its body deliberately never names tonight's active: a
`DAILY` trigger fires unchanged, and a check-in can deload the routine and rename the session
between scheduling and firing, so the banner could contradict the app. `feedback.ts` wraps
`expo-haptics` for the tick/complete/select moments — best-effort, no-ops off-device.

`apps/mobile/src/app/today.tsx` is the primary surface and shows **only the current session**;
`/plan` holds the full assessment and routine as a reference document. Keep it that way — the
whole point is that the user makes no decisions except the single "how does your skin feel?" tap.

## Architecture: the progress engine

`packages/shared/src/progress/engine.ts` is the third deterministic layer, and it answers the
question that decides retention: **is any of this working?**

The load-bearing decision is what it does *not* do. **Never show a model the before and after and
ask whether the skin improved.** A model handed a before-and-after will always find a story, and a
skincare app that confabulates progress is worse than one that says nothing. Instead each capture
session gets its own blind `Assessment` from the ordinary `/api/plan` call — which has no idea a
previous session exists — and `compareAssessments` subtracts the two in code. Preserve that
blindness; it is the whole credibility of the feature.

- **Comparability gate.** A photo only counts if the capture gate passed it *and* it was shot under
  `screen_flash`. Ambient light is not repeatable, so an ambient set can be displayed but never
  subtracted. With no measurable angle in common the engine reports nothing and says why. The
  refusal is the feature — this is why capture was built as an instrument.
- `AppearanceLevel` is ordinal, so bands subtract. A concern either assessment was unsure about
  (confidence < 0.6) is returned as `not_comparable`, never folded into the result.
- `adaptRoutine` turns the measurement into a routine change, and **always returns through
  `applySafetyRules`** (see `finish()` — every path goes through it). Adaptation proposes, the
  safety engine disposes, exactly like the LLM. It cannot raise a frequency past a cap or survive
  a pregnancy filter.
- Ordering is the safety argument: **worsening acts first and only ever reduces**; escalation sits
  behind two gates (`ESCALATE_AFTER_WEEKS`, and an adherence floor). "It isn't working" usually
  means "it isn't being done", and answering that with a stronger acid is how people damage their
  barrier. Improvement holds steady — adding more to a working routine is how progress gets undone.

`adaptRoutine` is a *proposal against a routine*, so running it on its own output steps the same
active up twice. It runs **once**, when a measurement lands (`runReassessment` in `compare.tsx`),
and the result is persisted via `saveAdaptation`. Never call it during render.

The baseline is recorded at signup (`onboarding/intake.tsx`) and never replaced — a moving zero
would let slow drift vanish. `/compare` is the verdict surface and the one place the app uses a
dark surface: measured concerns sit on the deep-green card, and anything the engine declined to
call is listed separately below so a refusal can never be skimmed as a result.

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
