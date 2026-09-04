# TODOS

Deferred work that is real. If it is not written here, it does not exist.

## Before launch

### Tune `CAPTURE_TUNING` on real devices
`packages/shared/src/vision/quality.ts` ships thresholds seeded from theory, not
from this product's camera. Exposure floors, the sharpness threshold and the
skin-coverage minimum all need to be measured against real captures **across the
full skin-tone range** and adjusted. A real front camera under real light will
not match the paper. The regression test in `quality.test.ts` locks in the
behaviour that matters (a correctly exposed deep-skin capture must not be called
"too dark"); the numbers around it are still provisional.

### Verify `flash="screen"` on device
`apps/mobile/src/app/onboarding/photo.tsx` sets `USE_NATIVE_SCREEN_FLASH = true`.
`'screen'` is a documented SDK 56 `FlashMode`, but the docs do not describe its
front-camera behaviour, and it has not been confirmed on hardware. Check on both
platforms. If it is a no-op, flip the flag to `false`: the app then paints its
own white overlay for `FLASH_MS` around the shutter and records the photo as
`ambient` rather than claiming a controlled illuminant it did not have.

### Screen-flash intensity per tone
A flash level that exposes fair skin correctly will clip its highlights and
underexpose deep skin. Intensity should follow the declared tone. Currently the
tone only moves the measurement thresholds, not the light itself.

## Next milestone

### Ghost-overlay re-alignment
On a return visit, render the previous photo at low opacity over the live camera
preview so the user matches distance and angle before shooting. This is what
makes week-over-week comparison meaningful, and it is why capture was built as an
instrument rather than a photo picker. Done: `apps/mobile/src/app/onboarding/photo.tsx`
renders the last session's photo for the current angle (via `sessionPhotoUri`) at
0.3 opacity behind `CaptureFrame`'s scrim, so it's automatically clipped to the
oval with no separate mask. No toggle, no copy — it just appears when a prior
session exists for that angle.

The storage foundation: `apps/mobile/src/lib/photos.ts` stores each session's
three JPEGs under its own `<sessionId>/` folder, alongside a per-session
`manifest.json` carrying each shot's angle, timestamp, quality score and
illuminant estimate, plus a top-level `sessions.json` index (`listSessions`) so
past sessions survive a new capture instead of being overwritten. Do not change
that schema without accounting for this.

Done: `apps/mobile/src/app/compare.tsx` (`/compare`, linked from the "Your
photos" card on Today once 2+ sessions exist) shows the newest session against
the one before it, one angle at a time via a chip row — no session picker, the
two most recent is the whole feature.

Still needed: a privacy story for keeping more than the latest set on the
device (`storedPhotoCount`/`deleteStoredPhotos` still treat every session as
one pool — there's no per-session delete or retention limit yet). The ghost
overlay itself is unverified on hardware — same caveat as `flash="screen"`
above: confirm the oval-clipped ghost image actually reads as "line up with
your last photo" on a real front camera before calling this done-done.

## Cadence engine follow-ups

### The ramp and deload constants are seeded from convention, not evidence
`packages/shared/src/schedule/engine.ts` picks `RAMP_WEEKS = 6`, a 3-day pause after a
"stinging" report and 2 days after a second "tight" one. Those match how
dermatologists usually phrase retinoid introduction, but they are round numbers,
not measurements. They are deliberately isolated as named constants at the top of
the module so they can be tuned in one place once there is real adherence data.

### No notification, so the app has to be opened to be useful
`/today` answers "what do I do right now", but nothing prompts the user to ask.
A single local notification at the user's chosen evening time is the obvious
partner to this screen, and it is the one place a reminder is genuinely earned
rather than growth spam. Needs `expo-notifications`, which is not a dependency yet.

### The user cannot see the ramp being held
`rampWeekFor` silently declines to advance a week the user reported irritation in.
That is the right behaviour and it is tested, but the UI never says it happened —
so a user who plateaus at week 2 has no idea why. There was a `ramp_held`
`ScheduleNote` id sketched for this and removed rather than left dead; it wants
reinstating with real copy and a test.

### `/today` is verified by static render only
The screen typechecks and renders through `expo export --platform web`, which is
enough to catch a crash but says nothing about how it feels in the hand: tap
target comfort on the step rows, whether the week strip reads at a glance, and
whether the check-in card appearing after the last tick feels earned or nagging.
Same caveat as the capture work below — confirm on hardware.

## Progress engine follow-ups

### `MIN_CONFIDENCE` and the escalation gates are judgement calls, not findings
`packages/shared/src/progress/engine.ts` picks a 0.6 confidence floor, an 8-week
wait before escalation, and a 70% adherence floor. All three are defensible and
none is measured. They are named constants at the top of the module for exactly
that reason. The adherence floor in particular is computed against a blunt
denominator (`daysElapsed * 2` in `apps/mobile/src/lib/journal.ts`), which
under-counts anyone who started mid-day — deliberately, since it only ever gates
making a routine *stronger*, so erring toward "not enough evidence" is the safe
direction. Revisit once there is real adherence data.

### The two elapsed-time numbers can disagree
The `/compare` headline says "measured across N weeks" from the gap between the
two photo sessions; the adaptation copy says "you're N weeks in" from
`journal.startedOn`. They normally track, but a user who starts the routine well
before their first photo, or re-captures late, will see two different numbers on
one screen. Pick one clock and derive both from it.

### Only two assessments are ever kept
`baseline` and `latest`, matching the two-photo-session model. That is the right
scope for the feature, but it means the middle of a six-month journey is not
recoverable and a trend line is impossible. Storing every assessment is cheap
(they are small JSON); the reason not to is that it needs a retention and
per-session delete story first, same gap the photos already have below.

### Re-assessment burns a full plan generation
`runReassessment` calls `fetchPlan`, which runs *both* model calls and throws the
returned routine away — only `.assessment` is used. That is a deliberate trade:
reusing the endpoint verbatim is what keeps the second reading blind and required
zero backend change. If the cost matters, add an assessment-only mode to
`/api/plan` rather than a second endpoint, and keep it ignorant of history.

### The verdict screen is verified by static render only
`/compare` bundles and renders through `expo export --platform web`, and all six
adaptation paths are covered by the engine's unit tests and a scenario sim. What
has not been checked on hardware: whether the dark verdict card reads as premium
rather than heavy next to the cream, and whether "we couldn't measure this"
lands as honesty or as the app looking broken. That second one is the whole bet.

## Housekeeping

### Marketing and app parity
Onboarding is now photo-first, which matches `apps/web/components/sections/HowItWorks.tsx`
and `FeatureCards.tsx`. Check no other marketing copy still describes an order
the app no longer uses.

### `apps/web` has no tests
`packages/shared` is the only package with a test suite. The `/api/plan` input
validation in `apps/web/app/api/plan/route.ts` is a trust boundary in front of a
paid endpoint and is currently only covered by manual probes.

## Security & cost hardening — deferred items

Recorded during the pre-production hardening pass. The pass itself bounded
`/api/plan`'s input, rate limited it, stopped it leaking error detail, and closed
the env-config gaps. These were found in the same audit and deliberately left.

### The parental-consent gate is decorative
`apps/mobile/src/app/onboarding/consent.tsx:17` collects a parent email from a
self-declared minor, verifies nothing, emails nobody, persists nothing, and
proceeds straight to face capture. The comment at `:18-19` already admits it.
This is a COPPA / GDPR-K exposure on photographs of children, and it is a larger
legal risk than anything the hardening pass fixed. A real gate needs a verifiable
consent request to the parent *before* capture, plus a recorded approval — which
needs the server-side persistence the product does not have yet.

### `/waitlist/confirmed` confirms a waitlist nobody joined
`apps/web/app/(auth)/signup/page.tsx:43` (and the Google button's `href` at `:138`)
navigate to `/waitlist/confirmed` without ever touching Tally. The waitlist lives
entirely in Tally (`lib/tally.ts`, form `LZVOM2`), so a user who fills in the signup
form is told "You're on the list" by a list that never received their email. Either
route signup through `openWaitlist()` or change the copy.

### The consent card contradicts the privacy policy
`consent.tsx:44-45` reads "Photos stay on your phone and are never saved on our
servers." The second clause is true; the first is not, once `EXPO_PUBLIC_API_URL`
is set — photos go to Pore's server and on to Anthropic. The formal policy
(`packages/shared/src/legal/content.ts:87`) discloses this correctly. The in-flow
card is the one users actually read, so it is the one that has to be right.

### Prompt caching on the two Opus calls
`ASSESSMENT_SYSTEM` / `ROUTINE_SYSTEM` are static and re-sent every request, so
`cache_control: { type: "ephemeral" }` on the system block of both `messages.parse`
calls in `apps/web/lib/pipeline.ts` is the natively-correct caching answer — one
line each, no dependency. Not done yet because the cache TTL is 5 minutes and an
app with no users has no two requests inside 5 minutes; today's hit rate is ~0.
It also silently no-ops below the model's minimum cacheable prefix. **Trigger:**
add it when traffic is bursty enough that requests land within 5 minutes of each
other, and verify with `usage.cache_read_input_tokens > 0` rather than assuming.

### The rate limiter is per-instance
`apps/web/lib/rate-limit.ts` is an in-memory Map. On Vercel that is per-lambda and
dies with a cold start: it stops a script, not a distributed caller. The durable
control is the input bound in `IntakeSchema`. Upgrade when there is real traffic:
Vercel Firewall rate-limit rules (no code) or an Upstash-backed counter (replace
the body of `rateLimit`, the signature is already the right shape). It keys on a
caller identity string, so it becomes a user id the day real auth lands.
