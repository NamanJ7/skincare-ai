# Production setup

How to take Pore from placeholder mode to live services. Every integration is
coded against env vars and degrades to an honest no-op when unset — the app
never fakes a session, a purchase, or an analysis. This doc grows one section
per phase as infrastructure lands.

## Environment variable matrix

| Variable | App | Exposure | Unset behavior |
| --- | --- | --- | --- |
| `EXPO_PUBLIC_API_URL` | mobile | client bundle | analysis fail-closed unconfigured |
| `EXPO_PUBLIC_SUPABASE_URL` | mobile | client bundle | accounts disabled; placeholder sign-in |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | mobile | client bundle | accounts disabled |
| `ANTHROPIC_API_KEY` | web | server | `/api/plan` returns 503 `ANALYSIS_UNAVAILABLE` |
| `SUPABASE_URL` | web | server | **`/api/plan` refuses every request (503)** |
| `SUPABASE_SERVICE_ROLE_KEY` | web | server | **`/api/plan` refuses every request (503)** |
| `IP_HASH_SALT` | web | server | **no IP hash is stored at all** (>=16 chars required) |
| `TRUSTED_PROXY_HOPS` | web | server | defaults to 1 (correct on Vercel) |
| `ALLOW_UNAUTHENTICATED_ANALYSIS` | web | server (dev only) | off; ignored in production |

> `/api/plan` spends two Opus calls per request, so it now **fails closed**: it
> requires a verified Supabase JWT and an atomic quota debit before invoking the
> model. Missing Supabase config no longer degrades to anonymous access — it
> stops analysis entirely. For local work without a Supabase project, set
> `ALLOW_UNAUTHENTICATED_ANALYSIS=true` (dev only; every permitted request logs
> a warning).

Planned for later phases: `EXPO_PUBLIC_POSTHOG_API_KEY`, `EXPO_PUBLIC_POSTHOG_HOST`,
`EXPO_PUBLIC_SENTRY_DSN`, `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `SENTRY_DSN`,
`REVENUECAT_WEBHOOK_TOKEN`, and build-time `SENTRY_AUTH_TOKEN`/`SENTRY_ORG`/`SENTRY_PROJECT`.

Local development: copy `apps/mobile/.env.example` → `apps/mobile/.env` and
`apps/web/.env.example` → `apps/web/.env.local`. EAS builds read env from
EAS-hosted environments (`eas env:create --environment development ...`);
`eas.json` maps development→development, preview→preview, beta/production→production.
No keys are ever committed.

## Phase 1 — Supabase backend

### Create the project

1. Create a project at [database.new](https://database.new). Any region close
   to your users. Save the database password somewhere safe.
2. From **Project Settings → API**, note:
   - Project URL → `EXPO_PUBLIC_SUPABASE_URL` (mobile) and `SUPABASE_URL` (web)
   - `anon` public key → `EXPO_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (web server ONLY)
3. Apply the schema:
   ```bash
   supabase login
   supabase link --project-ref <project-ref>
   supabase db push
   ```
   This runs everything in `supabase/migrations/` (tables, RLS, entitlement
   guard trigger, private `scan-photos` bucket). See `supabase/README.md` for
   design notes.
4. **Auth settings** (Dashboard → Authentication):
   - Enable Email provider. For development, turn OFF "Confirm email" so
     sign-up works without an email loop (turn it back on before launch).
   - **Enable "Allow anonymous sign-ins" (Providers → Anonymous). This is
     required, not optional.** The app signs in anonymously at boot so the
     pre-account onboarding funnel still carries a real `auth.uid()` for
     `/api/plan` to meter against. With it disabled the device holds no token
     and every analysis request is refused with 401.
   - Set a restrictive rate limit for anonymous sign-ins (Authentication →
     Rate Limits). Anonymous users are cheap to mint, so they are the natural
     way to farm per-user quota; the deployment-wide `global_daily_cap` in
     `service_flags` is the backstop, but limiting minting is the first line.
   - Apple provider: needs an Apple Developer account (Services ID + key).
     Skip until you have one — the app hides the Apple button when the device
     reports it unavailable, and email/password works without it.
5. **Set the abuse caps.** After `db push`, the `service_flags` table holds one
   row with `analysis_enabled = true`, `daily_cap_per_user = 3`,
   `global_daily_cap = 2000`. Tune these to your budget before launch — at
   roughly $0.30–1.70 per analysis, 2000/day is a worst case near $3.4k/day.
   To stop spend instantly at any time, with no redeploy:
   ```sql
   update public.service_flags set analysis_enabled = false where id = 1;
   ```
6. **Schedule cleanup for abandoned anonymous users.** Anonymous sign-in
   creates a real `auth.users` row per device. Supabase does not prune them
   automatically; delete anonymous users older than ~30 days that never
   converted, or they accumulate indefinitely.

### Wire the mobile app

Create `apps/mobile/.env`:

```
EXPO_PUBLIC_API_URL=http://<your-lan-ip>:3000
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

Restart Expo with a cache clear (`pnpm --filter @pore/mobile start -- --clear`)
after changing env vars.

**A new EAS dev-client build is required for this phase** (the
`expo-apple-authentication` native module was added):

```bash
cd apps/mobile && eas build --profile development --platform ios
```

### Wire the web app

Add to `apps/web/.env.local`:

```
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
IP_HASH_SALT=<any long random string>
```

### Phase 1 checkpoint script

Placeholder regression (env unset):

1. Remove/comment the Supabase vars from both env files; restart Expo + Next.
2. Sign-in screen shows "Account sync is not enabled yet" — no form.
3. Profile tab shows no Account row.
4. Full flow (onboarding → scan → routine) behaves exactly as before.

Live backend (dev project):

1. Set the env vars; restart. Sign-in now shows the email/password form;
   Profile tab shows "Create account".
2. Create an account. In the Supabase Table Editor, watch `profiles` /
   `routine_logs` rows appear as you use the app (writes sync ~0.5s after a
   change).
3. Sign out (Profile → Account) — local data stays; cloud writes pause.
4. Sign back in — no data loss.
5. Airplane mode: the whole app keeps working (local-first); writes sync
   after connectivity returns and another change is made.
6. New-device restore: delete + reinstall the app (or second device), sign
   in — profile, routine log, and scan metadata return from the cloud.
   (Scan photos restore lands in Phase 2 migration.)
7. `/api/plan` still works signed-out (the funnel now runs on an anonymous
   session, so there is still a real token); a garbage
   `Authorization: Bearer x` header returns 401; a 4th rapid analysis
   request returns 429.

### Abuse-control checkpoint

Run these against a dev deployment before launch. Each should reject *without*
a corresponding call appearing in the Anthropic dashboard:

1. **No token** — `curl -X POST .../api/plan -d '{}'` → 401.
2. **Spoofed IP** — replay a valid request 20x with a different
   `X-Forwarded-For` each time. The bucket must not reset; count Anthropic
   calls, not HTTP 200s.
3. **Replay** — send one valid analysis body twice → second returns 409
   `DUPLICATE_REQUEST`, and only one analysis is billed.
4. **Quota** — with `daily_cap_per_user = 1`, a second scan the same day
   returns 429 `QUOTA_EXCEEDED`.
5. **Concurrency** — with `daily_cap_per_user = 1`, fire 20 identical requests
   simultaneously. Exactly one may reach the model.
6. **Breaker** — set `analysis_enabled = false`; every request returns 503 and
   nothing reaches Anthropic.
7. **Oversized** — a 20 MB body returns 413 before any auth or model work.

### Known limitations (deliberate, Phase 1)

- ~~Sessions are stored in AsyncStorage (not SecureStore)~~ — **fixed.**
  Sessions now live in the iOS Keychain / Android Keystore via
  `apps/mobile/src/lib/backend/secure-session-store.ts`, which chunks values
  around SecureStore's ~2 KB item limit and migrates any existing AsyncStorage
  session on first read. **This added a native module, so a new EAS dev-client
  build is required.**
- `lib/rate-limit.ts` is in-memory and single-instance *by design*; it is a
  layer-1 shock absorber. The authoritative limit is the Postgres
  `claim_analysis_slot` RPC, which is shared and race-safe.
- The scan guard is an integrity check, not an anti-abuse control — only
  `contentDigest` is server-recomputed. Spend is bounded by identity + quota.
- Entitlement (Free/Plus) is still client-trusted; payments are not
  implemented, so nothing can be defrauded yet. The database already blocks a
  client from granting itself Plus (`entitlements_guard`, pinned by
  `supabase/tests/rls.test.sql`). Make entitlement server-authoritative when the
  RevenueCat webhook lands — specifically, change `hydrate.ts` so the
  `entitlement` key always takes the cloud value instead of local-wins.
- Photos are not yet uploaded to cloud storage; Phase 2's migration flow
  owns photo backup and the explicit "back up this device's data" moment.
- Two-device conflict resolution: cold-start fill only applies to keys that
  are empty locally; Phase 2 adds the explicit conflict choice at sign-in.

## Phase 1b — security hardening (2026-08-18)

### Account deletion

`DELETE /api/account` deletes the caller's storage objects and then their
`auth.users` row, which cascades every product table. The identity comes only
from the verified bearer token — there is no user id in the body or path, so
cross-user deletion is structurally impossible rather than merely checked.
Mobile calls it from Profile → "Delete my account", and only wipes local data
after the server confirms.

**Required Supabase setting:** none beyond `SUPABASE_SERVICE_ROLE_KEY`, which
the endpoint needs for the GoTrue admin API. Without it the route returns 503
rather than reporting a deletion it did not perform.

### Anonymous quota tier

`supabase/migrations/20260818000009_anonymous_quota_tier.sql` splits the daily
analysis cap by identity kind. Anonymous devices are free to mint, so they were
never bounded by a per-user cap; they now get `anon_daily_cap_per_user`
(default 1) and share `anon_global_daily_cap` (default 300), while converted
accounts keep `daily_cap_per_user` (default 3).

Both `claim_analysis_slot` and `release_analysis_slot` gained a
`p_is_anonymous` argument and the old 3-argument signatures are dropped, so a
stale deployment cannot keep calling an unmetered variant. An omitted flag
resolves to the *stricter* cap.

Tune all five values in `service_flags`:

```sql
update public.service_flags
   set daily_cap_per_user = 3,
       anon_daily_cap_per_user = 1,
       global_daily_cap = 2000,
       anon_global_daily_cap = 300
 where id = 1;
```

### IP hashing now fails closed

`hashIp` returns `null` unless `IP_HASH_SALT` is at least 16 characters. An
unsalted SHA-256 over the IPv4 space is a seconds-long rainbow table, so an
empty salt stored the address rather than a pseudonym — while the schema
comment promised "salted hash only". Set the salt, or accept that
`analysis_requests.ip_hash` stays null.

### RLS policy tests

`supabase/tests/rls.test.sql` (pgTAP) asserts cross-user SELECT/UPDATE/DELETE,
WITH CHECK on inserts and ownership reassignment, the entitlement guard,
anonymous access, service-role-only tables, RPC grants, and storage namespace
isolation — including the rename-into-another-uid case migration 8 fixed.

```bash
supabase init      # if there is no config.toml yet
supabase start
supabase test db
```

**These have never been executed** — there is no Supabase project yet. Run them
before launch; until then RLS behaviour is verified by inspection only.

### Web security headers

`apps/web/next.config.ts` now sets CSP, HSTS, `X-Content-Type-Options`,
`Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy` and COOP on every
route, pinned by `apps/web/lib/__tests__/security-headers.test.ts`.

Two CSP entries are load-bearing and must not be removed: `'wasm-unsafe-eval'`
(the MediaPipe face landmarker on `/scan`) and `worker-src blob:`. `camera=(self)`
in Permissions-Policy is likewise required by `/scan`.

`script-src` still needs `'unsafe-inline'` for Next's bootstrap scripts.
Removing it requires per-request nonces via middleware — a deliberate follow-up.

### Removed surfaces

- `apps/web/app/(auth)/login` and `/signup` — visual-only forms that collected
  real passwords into handlers that discarded them, linked from the site footer.
- `apps/web/app/api/waitlist` — an unauthenticated, service-role-backed PII
  writer with no callers (the site uses Tally). The `public.waitlist` table and
  its migration are retained so the endpoint can be restored deliberately.
