# Security audit — 2026-08-24

Full-repo audit across five vectors: ORM/dynamic-condition safety, API contract
minimization, SSRF, stored XSS, and CORS. Follows
[`security-audit-2026-08-18.md`](./security-audit-2026-08-18.md), which built the
fail-closed `/api/plan` spine, RLS, and the static header policy.

**Headline: no live exploitable vulnerability was found in any of the five
categories.** What follows is two real bugs, one CSP gap, and a set of
properties that were safe only because every current caller happened to pass a
constant — now safe by construction, each pinned by a test.

---

## What was NOT found, and why that is worth recording

Four of the five categories had no exploitable finding. The reasons are
structural, and knowing them stops the next audit re-deriving them:

- **Authorization bypass via dynamic filters** — `apps/web` has no ORM and no DB
  client touching user tables; all Supabase access is raw `fetch` in three
  server-only modules. Every mobile query carries `.eq("user_id", userId)` with
  `userId` from `auth.getSession()`, never from input, over RLS policies that
  enforce `auth.uid() = user_id` with matching `with check` on writes. The SQL
  functions use typed plpgsql parameters — no `EXECUTE`, no `format()`.
- **Data overfetching** — there are exactly two route handlers. Neither returns a
  DB row. `/api/account` derives identity from the token alone, so cross-user
  deletion is structurally impossible rather than merely checked.
- **SSRF** — no endpoint fetches a caller-supplied URL. Every outbound URL is
  `SUPABASE_URL` plus a hardcoded path, or the Anthropic SDK's host. No product
  search, barcode lookup, image proxy, webhook, or redirect handler exists; the
  product catalog is an on-device array with no URL field.
- **Stored XSS** — zero `dangerouslySetInnerHTML`, `innerHTML`, `document.write`,
  `srcDoc`, `v-html`, or `eval` in tracked source. No `react-native-webview`
  dependency. Model-generated text renders through React Native `<Text>`, which
  cannot parse HTML; the web app never renders model output at all.
- **CORS** — no `Access-Control-Allow-*` header existed anywhere, and auth is a
  bearer header rather than a cookie. That combination is what makes the API
  CSRF-immune, so the correct action was to *pin* it, not to add a policy.

---

## Fixed

### The two real bugs

**PostgREST filter injection → wrong-row deletion.**
`apps/mobile/src/lib/backend/cloud-store.ts` built an `in.(…)` list literal by
interpolating record ids. The ids look client-generated, but they round-trip
through the database: `pullAll` reads `payload` jsonb back and `pushScans`
re-derives the id from `payload.createdAt`. RLS permits a user to write arbitrary
jsonb into their own row, so an id could return carrying `"` or `,`, closing the
literal early and changing which rows the `delete().not("id","in",…)` *excluded*.
Bounded by RLS to the user's own data, so self-inflicted data loss, not
cross-tenant. Now charset-validated and **fails closed** — an unquotable id skips
the prune entirely, because a stale row is recoverable and a wrongly-deleted one
is not. The guard was also moved ahead of query construction so the builder is
never assembled for a request that will not run.

**Internal schema enumerated in an error body.**
`apps/web/app/api/plan/route.ts` carried a comment saying "Never echo
err.message: an intake-guard throw enumerates internal schema" — but the guard
sat on the wrong branch. `assertRuntimeIntake` throws `AnalysisRequestError`,
caught one branch *above*, so `POST {"intake":{}}` returned
`"Invalid intake profile: age, goals, sensitivity, currentProducts, allergies,
pregnancyOrBreastfeeding"` — precisely the fields the safety engine keys on.
`AnalysisRequestError` now carries a `detail` that is logged and never
serialized; client-facing messages are generic. The same treatment was applied to
the pipeline's `${label} did not return usable structured output`.

### CSP: `'unsafe-inline'` removed via per-request nonces

`script-src` contained `'unsafe-inline'` with a comment claiming browsers ignore
it. They only do so when the same directive *also* carries a nonce, hash, or
`'strict-dynamic'` — this policy had none, so it was honoured everywhere and the
CSP provided **no script-injection defense at all**.

`apps/web/proxy.ts` (Next 16's replacement for `middleware.ts`) now mints a
128-bit nonce per request and sets the policy on both the forwarded request
headers and the response. `apps/web/lib/csp.ts` builds it.

Two decisions worth recording:

- **No `'strict-dynamic'`.** It makes browsers ignore host sources, which would
  break the `https://tally.so` widget loaded via `next/script`, and MediaPipe
  reaches its wasm loader through a dynamic `import()` chain. `'self'` plus a
  per-request nonce blocks both real vectors — injected inline script and
  injected third-party script — and nothing can be uploaded to this origin to be
  served back as JS.
- **`export const dynamic = "force-dynamic"` in `app/layout.tsx` is
  load-bearing.** A statically prerendered page is generated at build time, when
  the proxy has never run, so its inline scripts carry no nonce and a policy
  without `'unsafe-inline'` blocks all ~40 of them — the page ships as
  unhydrated HTML. This was caught by curling the built app, not by any test;
  the first build after adding the nonce still emitted `○ Static` for every
  route and would have shipped broken.

The CSP is also now **route-scoped**: `/scan` gets no `tally.so` in `script-src`,
`connect-src`, or `frame-src`. `app/(site)/layout.tsx` had deliberately kept the
widget off the page that operates the camera and holds face photos in IndexedDB,
but the old global header still *permitted* those origins there — a ready-made
exfiltration channel for any future injection. `Cross-Origin-Resource-Policy:
same-origin` was added alongside the existing COOP.

### Preventive hardening

| Area | Change |
|---|---|
| SSRF scaffolding | New `apps/web/lib/safe-url.ts`. Protocol allowlist, credential rejection, private/loopback/link-local/CGNAT/multicast/reserved IPv4, full IPv6 expansion incl. IPv4-mapped and NAT64. Documents that validate-then-fetch is **not** DNS-rebinding-safe without a host allowlist. |
| Config as attack surface | `SUPABASE_URL` is validated before use in `quota.ts`, `account-delete.ts`, `supabase-auth.ts` — it is the base for requests carrying a project key, and an unsafe value now counts as *unconfigured* (existing fail-closed 503 path). |
| Redirect policy | `redirect: "error"` on all five Supabase fetches. These endpoints never legitimately redirect; following one would replay the service-role key at another host. |
| Path injection | `rpc(name: RpcName, …)` narrowed to a two-value union, so no caller-derived value can reach `${url}/rest/v1/rpc/${name}`. |
| Least privilege | `GET /auth/v1/user` now presents `SUPABASE_ANON_KEY` by preference. The caller's own token authenticates that call; `apikey` only identifies the project, so service-role was privilege sent on every request. |
| Fail-open removal | `verifyOptionalBearer` deleted. Unused, and its catch degraded to `{kind:"anonymous"}` on network failure — an outage becomes an authorization bypass on any endpoint that trusts anonymous. |
| Token revocation | The verification cache now clamps to the token's own `exp`. A token expiring one second after verification stayed accepted for five more minutes, including on the irreversible delete endpoint. |
| Wire contract | `toPlanResponse()` picks the four public fields. `PlanResult` is internal and free to grow; `Response.json(result)` would have shipped every future addition to clients. |
| Forwarded headers | `x-vercel-forwarded-for` / `x-real-ip` are trusted only when `VERCEL=1` or `TRUST_PLATFORM_FORWARDED_HEADER=true`. Off-platform they are caller text — and `hashIp()` of that value is what lands in `analysis_requests.ip_hash`, so a caller could choose the pseudonym in their own audit trail. |
| Input bounds | Check-in note capped at 500 (in `addCheckIn`, not just the TextField); product name at 120; scan-session identifiers at 128 chars / 64 for a SHA-256 digest. |
| Protocol allowlists | `openExternalLink` (https/mailto only — `canOpenURL` is a capability check, not a safety check) and web `Button` href. Both latent: every caller today passes a constant. |
| Route params | `safeInternalHref()` replaces `startsWith("/")`, which also accepted `//evil.com`. `onboarding/generating.tsx` had no validation at all. |

### CORS: env-driven allowlist, off by default

`apps/web/lib/cors.ts` plus `OPTIONS` on both routes. With `ALLOWED_ORIGINS`
unset — the production default — **nothing is emitted** and preflights are a bare
405, byte-identical to previous behaviour. When set, the exact origin is echoed
(never `*`, which is refused even if configured, and is meaningless alongside
`Authorization` anyway), methods are scoped per route, and
`Access-Control-Allow-Credentials` is never sent.

This also closes a real functional gap: the Expo web preview on
`127.0.0.1:8104` could not call `/api/plan` at all — `Authorization` plus a JSON
content-type force a preflight, and no route exported `OPTIONS`, so it surfaced
as an indistinguishable generic network error.

---

## Verification

`pnpm typecheck` clean across all three workspaces; `pnpm lint` clean;
`pnpm test` **1000 passing** (147 shared / 307 web / 546 mobile), up from 821.
`pnpm --filter web build` succeeds.

Tests added: `safe-url.test.ts` (60), `cors.test.ts` (17), `csp.test.ts` (20),
`external-links.test.ts` (19), plus prune-filter-safety and tenant-scoping suites
in `cloud-store.test.ts` and new cases in the plan/account route tests, intake
guard, rate limit, supabase-auth, check-in, product catalog, and route access.

Checked against a running production build (`pnpm --filter web start`):

- every inline script on `/`, `/pricing`, `/scan` carries the response header's
  nonce (39/39, 13/13, 5/5), with no `'unsafe-inline'` and a fresh nonce per
  request;
- `/scan` CSP contains no `tally.so`; marketing pages do;
- `OPTIONS /api/plan` and `/api/account` → 405 with zero `Access-Control-*`
  when unconfigured; 204 with an exact-echo origin and per-route methods when
  allowlisted; never `Allow-Credentials`;
- `POST /api/plan {"intake":{}}` → 401/400 whose body contains none of the
  intake field names;
- `/mediapipe/*` assets still serve (the proxy matcher skips them).

**Not covered by any of the above:** the `/scan` camera flow end-to-end in a real
browser. The CSP directives MediaPipe needs (`'wasm-unsafe-eval'`, `worker-src
blob:`, `img-src blob:`) are pinned by `csp.test.ts` and the assets serve, but a
human should run one capture through to quality validation with devtools open
and confirm zero CSP violations before this ships.

---

## Known limitations, unchanged

- **`scan-analysis-guard` is an integrity check, not an anti-abuse control.**
  `contentDigest` is the only value the server independently recomputes; a caller
  who reads the client source can assemble a self-consistent session over
  arbitrary images. Deliberately pinned by a negative test. Cost is bounded by
  identity and quota, never by this module.
- **Layer-1 rate limiting is in-process** and keyed on `auth.userId`, and
  anonymous Supabase identities are free to mint. The real spend bound is the
  Postgres `claim_analysis_slot` claim with its stricter anonymous tier.
- **RLS policies are asserted in `supabase/tests/rls.test.sql` but have not been
  run against a live project.** Still outstanding from the 2026-08-18 pass.
