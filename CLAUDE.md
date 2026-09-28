# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"Pore" — an AI skincare app. pnpm + Turborepo monorepo with three workspaces:

- `apps/web` — Next.js 16 (App Router): marketing site (`app/(site)`), browser scan flow (`app/scan`), and the server-side AI pipeline (`app/api/plan`).
- `apps/mobile` — Expo 56 / expo-router app (`@pore/mobile`), the primary product surface.
- `packages/shared` — `@pore/shared`: design tokens, the safety engine, scan-quality logic, and domain types. Ships raw TypeScript source (no build step); consumed via subpath exports `@pore/shared/{design,safety,scan,types}`.

## Commands

pnpm 9, Node >= 20. Run from the repo root (path contains a space — quote it in shell commands).

```bash
pnpm dev / build / lint / typecheck / test    # turbo, all workspaces

pnpm --filter web dev                          # Next.js on :3000 (needs ANTHROPIC_API_KEY for /api/plan)
pnpm --filter @pore/mobile start               # expo start
pnpm --filter @pore/shared test                # vitest run

# Single test file (vitest — works in web, mobile, shared):
pnpm --filter @pore/shared test src/safety/engine.test.ts
pnpm --filter @pore/mobile test src/lib/gate.test.ts
```

Tests are co-located `*.test.ts` vitest files next to the modules they cover (heavily used in `apps/mobile/src/lib` and `packages/shared/src`).

`.npmrc` sets `node-linker=hoisted` + `shamefully-hoist` deliberately — Metro and Next need a flat `node_modules` (especially on Windows). Don't change it. `apps/mobile/metro.config.js` makes Metro watch the workspace root to resolve `@pore/shared`.

Mobile native builds use EAS dev clients (`apps/mobile/eas.json`); MLKit face detection requires a real iOS device (no arm64 simulator slice). Expo APIs changed at v56 — check https://docs.expo.dev/versions/v56.0.0/ before writing Expo code (see `apps/mobile/AGENTS.md`).

## Core architecture

### The plan pipeline (server-only, `apps/web/lib/pipeline.ts`)

photos + intake → Claude vision call (structured `Assessment`, cosmetic-only, never diagnostic) → Claude routine call (draft `Routine`) → deterministic safety engine from `@pore/shared` → final routine + `SafetyAdjustment[]` audit trail. Structured outputs use `zodOutputFormat` against schemas in `apps/web/lib/schemas.ts`; prompts live in `apps/web/lib/prompts.ts`.

### Fail-closed scan analysis — the non-negotiable invariant

A scan result is never faked, cached, mocked, or substituted. Analysis accepts only a quality-validated three-pose session: the server re-hashes each image and matches it against the session's accepted captures (`apps/web/lib/scan-analysis-guard.ts`) before the model is invoked. If the vision service is unconfigured or unreachable, the client gets an explicit `unconfigured`/`error` outcome and the app shows a clearly-labeled answer-based fallback — never a fabricated scan. Mobile reaches the pipeline via `EXPO_PUBLIC_API_URL` (dev machine's LAN IP, e.g. `http://192.168.x.x:3000`); `ANALYSIS_CONFIGURED` in `apps/mobile/src/lib/api.ts` drives honest privacy copy. Full design: `docs/scan-quality-architecture.md`.

**The guard is an integrity check, not an anti-abuse control — do not confuse the two.** Both the session and the images come from the same untrusted request, and `contentDigest` is the *only* value the server independently recomputes; perceptual hashes, yaw angles, timestamps and per-metric verdicts are all caller claims. It reliably rejects mismatched, reordered, reused, stale and near-duplicate captures, but a caller who reads the client source can assemble a self-consistent session over arbitrary images — pinned by `apps/web/lib/__tests__/scan-analysis-guard.test.ts`. Cost is therefore bounded by identity and quota, never by this module.

### Paid-path abuse controls (`/api/plan`)

One analysis is two Opus calls (~$0.30–1.70), so the endpoint is metered in layers and **every layer fails closed**. Order in `apps/web/app/api/plan/route.ts` is deliberate — cheapest rejection first, the model call last:

`Content-Length cap → verifyBearer (required) → in-process IP bucket → shape + per-image size validation → claim_analysis_slot → generatePlan → release_analysis_slot`

- **Identity** — `verifyBearer` (`lib/supabase-auth.ts`) requires a real Supabase JWT. Mobile signs in *anonymously* at boot (`src/state/session.tsx`) so the pre-account onboarding funnel still works and every device is meterable; signing up converts that same `auth.uid()` in place via `updateUser`. An absent, invalid, or unverifiable token never reaches the model.
- **Quota, replay and breaker** — one atomic `claim_analysis_slot` RPC (`supabase/migrations/20260817000008_analysis_quota.sql`) checks the breaker, claims a `(user_id, request_hash)` row for idempotency, and debits per-user and deployment-wide daily counters in a single transaction. Race safety comes from conditional upserts, so concurrent requests cannot each see the last slot. Tune caps or stop spend instantly by editing `service_flags` — no redeploy.
- **`lib/rate-limit.ts` is layer 1 only.** It is in-process, so it resets on cold start and multiplies by instance count. Never treat it as the spend bound. Its key comes from `trustedClientIp`, which reads the *right-hand* end of `x-forwarded-for` — hop 0 is caller-writable text.
- **Refunds** — an `AnalysisRequestError` is only ever raised before the Anthropic client is constructed, so it releases the slot as `refunded`; anything else may have been billed and keeps the debit.

When adding an expensive endpoint, reuse this spine. When adding a *free* one, still give it `trustedClientIp` + a bucket.

### Safety engine (`packages/shared/src/safety/engine.ts`)

Deterministic CODE, not prompts — corrects whatever the LLM returns and records every change: sunscreen always in AM, pregnancy/allergy removals, retinoid frequency ramp, one strong irritant per session, sensitivity caps, cleanser/moisturizer baseline, no clinician-only actives. When touching routine output anywhere, the safety engine is the enforcement point; don't re-implement its rules in prompts or UI.

### Scan quality system

`packages/shared/src/scan` is the single source of truth: capture state machine, independent quality checks, guidance prioritization, and three-pose session validation. Platform adapters feed it evidence:
- `apps/web/lib/scan` — browser camera + MediaPipe face landmarker (self-hosted assets).
- `apps/mobile/src/lib/scan` — native VisionCamera/MLKit live guidance plus `.web.ts` fallbacks; content digests bind captures to the analysis request.

Preview-quality results are never copied onto the final frame — the final image is independently re-validated.

### Mobile app structure

expo-router file-based routing in `apps/mobile/src/app`: onboarding funnel (`onboarding/`), main tabs (`(tabs)/` — Home/Routine/Scan/Progress/Shelf), `scan-flow/`, `check-in/`, paywall. Pure logic lives in `src/lib` (plan, gate, shelf, skin-status, trends, results…); React context providers in `src/state`; screens stay thin.

Premium gating: `src/lib/gate.ts` — one free analyzed scan; routine is shown free and the paywall is skippable.

### Mobile visual system

`@pore/shared` design tokens → `src/theme/ui.tsx` primitives → `src/theme/patterns.tsx` composed patterns → `src/components/FunnelScreen.tsx` for onboarding layout. The "calm premium" rules: serif (Fraunces) for brand moments only, pill shape for the single primary CTA only, at most ~2 white cards per screen — content sits on the cream canvas under `SectionHeader`s, notes are tinted `Callout`s. Build new screens from patterns/primitives rather than ad-hoc styles.

## Docs worth reading before deeper changes

- `docs/scan-quality-architecture.md` — scan invariants and module ownership.
- `apps/mobile/docs/` — native scan guidance, scan analysis wiring, QA protocol, product search.
