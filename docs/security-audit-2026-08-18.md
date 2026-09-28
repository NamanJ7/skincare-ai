# Pore — security, privacy & App Store readiness audit

**Date:** 2026-08-18 · **Scope:** P0 + P1 launch blockers · **Gates:** lint, audit:copy, typecheck, test (85 files / 821 tests), build — all green.

---

## Executive summary

Pore's paid-analysis path was already well defended before this pass: `/api/plan` had a
real layered spine (required bearer → in-process bucket → shape validation → atomic
Postgres quota claim → model → refund/keep-debit), every user table had RLS with own-row
policies and no `true` policy anywhere, both `SECURITY DEFINER` functions pinned
`search_path`, and CI ran gitleaks plus a bespoke copy-claims audit. The existing
`route.test.ts` asserts `generatePlan` was *not called* rather than merely checking
status codes — a materially stronger property than most codebases test.

The gaps were elsewhere: **the App Store surface, which had never had a pass**, and a
small number of guards that looked correct but did not hold.

Three defects were verified by execution, not inference:

1. The request-size ceiling on both API routes passed whenever `content-length` was
   absent (`Number("")` is `0`, and `0 > MAX` is false).
2. `IntakeSchema` had no length bound on any string or array, all of which are
   interpolated verbatim into two `max_tokens: 32_000` Opus prompts.
3. No code path anywhere deleted the full-resolution face JPEGs that VisionCamera and
   ImageManipulator write to the cache directory — so "Delete my data" did not do what
   both the Profile dialog and `privacy-controls.tsx` claimed.

The single hardest blocker was that **account deletion did not exist**, while the app
creates real `auth.users` rows. That is a categorical App Review rejection.

---

## P0 — Critical

### P0-1 · No account deletion (App Review Guideline 5.1.1(v))

| | |
|---|---|
| **Component** | `apps/mobile/src/app/(tabs)/profile.tsx`, no server endpoint existed |
| **Root cause** | "Delete my data" cleared AsyncStorage + `documents/photos` only. `storage.ts` documents *"clearAll() intentionally does NOT notify [the mirror] — account deletion is an explicit flow"*. That flow was never built, so a user who deleted their data kept a live auth identity and a full server-side copy of their skin assessments. |
| **Fix** | New `DELETE /api/account` (`apps/web/app/api/account/route.ts` + `apps/web/lib/account-delete.ts`): `verifyBearer` → per-user rate limit → delete storage objects under `{uid}/` → `DELETE /auth/v1/admin/users/{id}`, which cascades all seven product tables. Mobile Profile gained "Delete my account" for signed-in users; it calls the server **first** and only wipes locally on confirmation. Fires the previously-unreachable `account_deletion_requested`/`completed` events. |
| **Trust boundary** | The user id comes *only* from the verified token. There is no id in the body, path, or query — cross-user deletion is structurally impossible, not merely checked. |
| **Tests** | 12 in `apps/web/app/api/account/__tests__/route.test.ts`, incl. *"ignores a user id supplied in the body"*, *"removes storage objects before the auth identity"*, *"does not delete the identity when storage cleanup fails"*, and idempotency. Verified live: `DELETE /api/account` with no token → 401 with nothing deleted. |

### P0-2 · Request-size ceiling bypassable on both routes

| | |
|---|---|
| **Component** | `apps/web/app/api/plan/route.ts:55`, `apps/web/app/api/waitlist/route.ts:21` |
| **Root cause** | `Number(req.headers.get("content-length") ?? "")` evaluates to `0` when the header is absent. `0 > MAX_BODY_BYTES` is false, so any chunked `Transfer-Encoding` request skipped the 6 MB ceiling and fell into an unbounded `req.json()`. Confirmed by executing the expression. |
| **Fix** | New `apps/web/lib/read-bounded-body.ts` streams the body with a running byte counter and cancels the reader the moment the cap is exceeded. The header check is retained purely as the cheap pre-filter it always was. Counts **bytes**, not string length, so multi-byte input cannot slip through. |
| **Tests** | 6 unit tests + 1 route test (*"rejects an oversized chunked body that omits content-length"* → 413, `generatePlan` not called). Verified live: a 9.1 MB chunked body is rejected. |

### P0-3 · Unbounded intake reaching both Opus prompts

| | |
|---|---|
| **Component** | `apps/web/lib/intake-guard.ts` |
| **Root cause** | `currentProducts`, `allergies`, `allergyNotes`, `location` and `goals` had no `.max()` on the array *or* the strings. `pipeline.ts` interpolates the whole object verbatim, twice per request. That is unbounded token inflation on a 32k-token model plus an open prompt-steering channel. |
| **Fix** | Explicit `LIMITS` on every string and array, sized above what the mobile client can actually produce. `apps/mobile/src/app/onboarding/safety.tsx` gained a matching `maxLength={500}` so a long note is trimmed on-device rather than 400-ing at analysis time. Both system prompts in `prompts.ts` now explicitly frame intake as untrusted data, with the note that the deterministic safety engine validates output regardless. |
| **Tests** | 8 bound tests + a route test proving oversized intake is rejected **before** a slot is claimed. |

---

## P1 — High

### P1-1 · Face photos left in the cache directory forever

`grep` for `.delete()` across `apps/mobile/src` hit only `photos.ts` (documents dir) and
`cloud-store.ts` (DB rows). Every ImageManipulator encode (`session-builder.ts:130`,
`quality-check.ts:42`, `static-photo-evidence.ts:83`) and every VisionCamera still was
abandoned in cache — surviving the scan, and surviving "Delete my data", bounded only by
whenever iOS chose to reclaim space.

**Fix:** `discardTempPhotos()` in `photos.ts`; transient encodes deleted at the point
their base64 is consumed; `clearShots()` — the one funnel every scan exit already passes
through (retake, abandon, complete) — now disposes the raw still and the analysis encode;
`deleteAllPhotos()` sweeps the cache directory too.

`scan-session.ts` takes its disposer by **registration** (`setScanPhotoDisposer`,
installed in `app/_layout.tsx`) rather than importing `photos.ts`, because
`expo-file-system` cannot be loaded under vitest and that module is pure in-memory state
the test suite depends on. 3 tests pin the contract, including *"clears state even when
the disposer throws"* and *"empties state before disposing"*.

Ordering was re-verified: `clearShots()` runs only after `buildAnalysisSubmission` has
the bytes in memory and `persistScanShots` has copied timeline photos to documents.

### P1-2 · Session tokens in plaintext, backed-up storage

Supabase sessions — including the long-lived **refresh token** — sat in AsyncStorage: an
unencrypted container file included in iCloud/iTunes backups.

**Fix:** `apps/mobile/src/lib/backend/secure-session-store.ts` puts them in the iOS
Keychain / Android Keystore, chunking around SecureStore's ~2 KB item limit and migrating
any existing AsyncStorage session on first read — so upgrading does not sign anyone out.
Every method is failure-tolerant; an unhandled rejection here would surface as a red
screen during hydration.

9 tests, including *"round-trips a value far larger than the SecureStore item limit"*,
*"does not concatenate a longer previous value onto a shorter new one"*, and *"keeps the
legacy copy when the secure write fails"*. Writing these caught a real cross-test mock
leak, which was fixed rather than worked around.

### P1-3 · Anonymous identities farmed the per-user analysis cap

The app signs in anonymously at boot (correctly — the funnel needs a meterable
`auth.uid()`). But an anonymous user is free to mint, so `daily_cap_per_user = 3` was
never a bound on a script; the only real ceiling was `global_daily_cap = 2000`, i.e. the
entire deployment budget (~$3.4k/day at $1.70 a scan).

**Fix:** `supabase/migrations/20260818000009_anonymous_quota_tier.sql` adds
`anon_daily_cap_per_user` (default 1) and `anon_global_daily_cap` (default 300).
`verifyBearer` now returns `isAnonymous`, threaded through to `claim_analysis_slot`.
The old 3-argument RPC signatures are **dropped** so a stale deployment cannot keep
calling an unmetered variant, and an omitted flag resolves to the *stricter* cap in both
the SQL and the route. 4 tests, including *"treats a missing is_anonymous claim as
anonymous, not as an account"*.

### P1-4 · `ip_hash` was reversible while the schema promised otherwise

`IP_HASH_SALT` defaulted to `""`. An unsalted SHA-256 over the 2³² IPv4 space is a
seconds-long rainbow table, so `analysis_requests.ip_hash` stored the address with extra
steps — next to facial-scan activity, and contradicting the migration comment. `hashIp`
now returns `null` below a 16-character salt, and callers omit the field entirely. 4 tests.

### P1-5 · No security headers on apps/web

`next.config.ts` set nothing. Now sets CSP, HSTS, `X-Content-Type-Options`,
`Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` and COOP on every route, with
`poweredByHeader: false`. **Verified live** against a production build — all present,
`X-Powered-By` absent. 16 tests pin the policy, specifically flagging the two
load-bearing entries (`'wasm-unsafe-eval'` and `worker-src blob:` for MediaPipe, and
`camera=(self)`) whose removal would break `/scan` silently.

### P1-6 · Web `/login` and `/signup` collected real passwords into no-op handlers

Both rendered `type="password"` with `autoComplete="current-password"` / `"new-password"`,
so password managers offered to save a credential into a form that called
`e.preventDefault()` and discarded it. `/login` was linked from the site footer. There is
no web auth backend. **Deleted** (routes, `components/auth/Field.tsx`, footer entry,
header buttons) per your decision.

### P1-7 · `/api/waitlist` — unauthenticated service-role PII writer with no callers

Wrote name/email/skin-concerns/spend/user-agent to Postgres with the service-role key,
protected only by an in-process bucket that resets on every cold start, with
`merge-duplicates` on email allowing anyone to overwrite an existing subscriber's row.
Nothing called it — the site uses Tally. **Route deleted; `public.waitlist` table and its
migration retained** so it can be restored deliberately.

### P1-8 · Web `/scan` had no age gate and no photo consent

The Privacy Notice states *"All users are asked separately before any face photo is
captured"* and describes a 13+/guardian framework — both mobile-only. New
`ScanConsentGate` runs before `getUserMedia` and before the MediaPipe warmup, using the
shared `age-policy`: under-13 blocked, 13–17 requires guardian affirmation, everyone
affirms the photo terms. Per-visit, never persisted — matching the mobile rule.

### P1-9 · No password reset

A user who forgot their password permanently lost every backed-up scan and routine.
Added `resetPassword` to the session provider (`resetPasswordForEmail` with a
`pore://reset-password` deep link) and a "Forgot password?" affordance. The response is
**identical whether or not the address has an account**, so it is not an enumeration
oracle.

### P1-10 · App Store configuration

`apps/mobile/app.json` gained: `ios.privacyManifests` (required-reason declarations for
UserDefaults `CA92.1`, file timestamp `C617.1`, disk space `E174.1`, boot time `35F9.1`,
plus `NSPrivacyCollectedDataTypes` and `NSPrivacyTracking: false`);
`NSMotionUsageDescription` (`use-hold-still.ts:28` calls
`DeviceMotion.requestPermissionsAsync()` and no string was declared — a crash or generic
boilerplate risk); `ITSAppUsesNonExemptEncryption: false`; and the
`com.apple.developer.default-data-protection = NSFileProtectionComplete` entitlement,
safe here specifically because the app declares no `UIBackgroundModes`.

### P1-11 · Legal text contradicted the implementation

`privacy/page.tsx` now names the subprocessors that already receive personal data
(**Anthropic, Supabase, Vercel, Tally**), discloses the hashed IP and waitlist user-agent
retention, describes account backup and the web scan's local-only storage, and documents
the real deletion flow. The sentence *"Any cloud storage or new processor will be
described in this notice before it is used"* — already violated by both Supabase and
Anthropic — was removed.

The Tally script was moved from the root layout to `(site)`, so it no longer loads on
`/scan`, the one page that operates the camera.

### P1-12 · Paywall advertised an unpurchasable subscription

`PaywallContent.tsx` showed "US$10.99 / month reference price" and a 14-day introductory
offer with no StoreKit product behind it — Guideline 2.1/3.1.1 exposure. Since Plus stays
interest-only, the price and offer copy are gone, replaced with an honest "not on sale
yet".

---

## Test-infrastructure fixes (found while working)

- **`apps/mobile/vitest.config.ts` did not exist.** The suite passed only because every
  `@/` import in a test happened to be type-only, so esbuild erased it before resolution.
  The first *value* import through `@/` would have broken CI with an opaque parse error —
  which is exactly what happened when the SecureStore work landed. Now configured with
  the alias plus a stub for `expo-secure-store`.
- **`apps/web/vitest.config.ts` had `passWithNoTests: true`**, which would have turned the
  entire security suite green if a glob were ever typo'd. Removed.

---

## Database changes

| File | Change |
|---|---|
| `supabase/migrations/20260818000009_anonymous_quota_tier.sql` | Adds `service_flags.anon_daily_cap_per_user` (1) and `anon_global_daily_cap` (300); adds `analysis_global_usage.anon_used`; replaces `claim_analysis_slot`/`release_analysis_slot` with `p_is_anonymous` variants; **drops** the old 3-arg signatures; revoke-before-grant on both new functions. |
| `supabase/tests/rls.test.sql` | New. 35 pgTAP assertions. |

No schema change was needed for account deletion — every table already declares
`references auth.users (id) on delete cascade`.

---

## Tests added

| Area | File | Count |
|---|---|---|
| Account deletion | `apps/web/app/api/account/__tests__/route.test.ts` | 12 |
| Body bound | `apps/web/lib/__tests__/read-bounded-body.test.ts` + 2 route tests | 8 |
| Intake bounds | `apps/web/lib/__tests__/intake-guard.test.ts` | 8 |
| Security headers | `apps/web/lib/__tests__/security-headers.test.ts` | 16 |
| Anonymous identity | `apps/web/lib/__tests__/supabase-auth.test.ts` | 4 |
| IP salt | `apps/web/lib/__tests__/rate-limit.test.ts` | 4 |
| Secure session store | `apps/mobile/src/lib/backend/secure-session-store.test.ts` | 9 |
| Photo disposal | `apps/mobile/src/lib/scan-session.test.ts` | 3 |
| RLS policies | `supabase/tests/rls.test.sql` | 35 — **NOT RUN** |

Repo total: 85 test files, 821 tests, all passing.

---

## Live re-audit

Against a production build on `next start`:

| Attack | Result |
|---|---|
| `DELETE /api/account`, no token | 401, nothing deleted |
| `DELETE /api/account`, forged token | 503 fail-closed, nothing deleted |
| `DELETE /api/account`, victim's id in body | 401 — body id never read |
| `POST /api/plan`, no token | 401 |
| 9.1 MB body with `content-length` | 413 |
| 9.1 MB chunked body, no `content-length` | rejected (401 at auth, which precedes the read; 413 for an authenticated caller, per route test) |
| `GET /api/waitlist`, `/login`, `/signup` | 404 — gone |
| Security headers on `/` | all 7 present, `X-Powered-By` absent |

---

## App Store readiness

| Item | Status |
|---|---|
| Privacy Policy exists and is reachable | **PASS** (content reconciled with implementation) |
| Terms of Service exists and is reachable | **NEEDS REVIEW** — no governing law, liability, warranty, IP, termination, or refund clauses |
| Account deletion exists | **PASS** |
| Account deletion actually works end-to-end | **NEEDS REVIEW** — unit-tested; never run against a real Supabase project |
| Purchase flow | **PASS** — nothing is sold, and no fake purchase UI remains |
| Restore purchases | **N/A** — no IAP |
| Permissions necessary and explained | **PASS** — camera, notifications, motion; no photo library, mic, location, or ATT |
| Privacy manifest present | **NEEDS REVIEW** — declared in `app.json`; requires prebuild + archive to confirm |
| Privacy disclosures match implementation | **PASS** |
| No placeholder / dead buttons | **PASS** — repo-wide scan found none |
| Production build | **PASS** |
| 13+ vs "18 and older" policy | **FAIL** — see below |

---

## Remaining risks — honest

**NOT VERIFIED (no Supabase project exists):**
- All 35 RLS assertions. Policies are verified by inspection only. Run
  `supabase start && supabase test db` before launch.
- Account deletion against real GoTrue/Storage.
- The anonymous quota tier migration has never been applied.

**NOT VERIFIED (no prebuild/archive/device):**
- Generated `Info.plist`, the privacy manifest, and the data-protection entitlement.
- SecureStore migration on a device with an existing AsyncStorage session.
- Whether `NSFileProtectionComplete` causes any issue in practice (low risk — no
  background modes — but unverified).
- Whether the CSP breaks `/scan` in a real browser. The header is asserted and the two
  load-bearing directives are pinned, but MediaPipe was not exercised behind it.
- Whether `pore.skin` actually serves `/privacy` and `/terms`. No deploy config is in the
  repo.

**Known-open, deliberately deferred (P2/P3):**
- `verifyOptionalBearer` is dead code that fails *open* — delete it before anyone wires
  it to a paid route.
- Token revocation lags up to 5 minutes (`verifyBearer` cache TTL).
- `supabase-auth.ts` uses the service-role key where the anon key would do.
- `analysis_requests` has no pruning.
- `x-vercel-forwarded-for` is trusted unconditionally — correct on Vercel, a hole
  anywhere else.
- The quota request hash is built from client-supplied `contentDigest` before the guard
  recomputes it. Impact is bounded (a mismatch is refunded before any model call).
- Guardian PIN is a 4-digit single-round SHA-256 whose salt+digest sync into
  `profiles.onboarding`. Trivially brute-forceable; keep it local or use a slow KDF.
- Entitlement is client-trusted. Harmless while nothing is sold; becomes the fraud vector
  the day payments ship. Fix `hydrate.ts`'s local-wins rule at the same time.
- No crash reporting. You will be blind to native crashes at launch.
- **`expo install --check` fails on 15 outdated Expo packages.** Pre-existing — the
  committed versions were older still, and `expo-secure-store` (the only dependency added
  here) is at the expected version. Not bumped, per "do not blindly upgrade".

**Policy contradiction that needs your decision:** the shipped legal pages describe a 13+
product with guardian and teen consent flows, and the code implements exactly that.
`docs/beta-release-checklist.md` says *"Beta is restricted to adults 18 and older."* These
cannot both be true. Shipping to 13–15-year-olds pulls in COPPA and Kids-category
obligations well beyond an on-device PIN.

---

## Manual actions required

1. **Create the Supabase project and apply migrations** (`supabase db push`), then run
   `supabase test db`. Until this happens, RLS is unverified.
2. **Set `IP_HASH_SALT`** to ≥16 random characters, or accept that `ip_hash` stays null.
3. **Tune `service_flags`** to your actual budget before launch — all five caps.
4. **New EAS dev-client build required** — SecureStore is a native module.
5. **Enable "Allow anonymous sign-ins"** in Supabase Auth (still required) and set a
   restrictive anonymous sign-in rate limit — that is the first line against identity
   farming; the caps are the backstop.
6. **Turn "Confirm email" back on** before launch.
7. **Verify the archive** contains `PrivacyInfo.xcprivacy` and the data-protection
   entitlement after `expo prebuild`.
8. **Test `/scan` in a real browser** behind the new CSP.
9. **Legal review** of the Terms (missing standard clauses) and the 13+ decision.
10. **Confirm `pore.skin` serves `/privacy` and `/terms`** — mobile links to them.
11. **Schedule cleanup of abandoned anonymous `auth.users`** (~30 days).
12. Consider adding crash reporting before external beta.
