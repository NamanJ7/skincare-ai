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

## Roadmap

Agreed order after persistence landed. Each one assumes the one before it.

### 1. Product shelf
`packages/shared/src/types/product.ts` defines `Product` and `StepRecommendation`
and nothing imports them. The routine names an active and stops there — there is no
bridge from an `ActiveKey` to something buyable, while the marketing site already
promises a shelf (`HowItWorks` step 2, and "Product shelf" in `apps/web/lib/pricing.ts`
as a free-tier feature).

Match deterministically in `packages/shared/src/products/`, tested next to
`engine.test.ts` — same reason the safety engine is code and not a prompt. Filters
come from fields that already exist: the step's `active`/`category` against
`Product.actives`, `fragrancePreference` → `fragranceFree`, `sensitivity: "high"` →
`sensitiveSafe`, and `currentProducts` → `alreadyOwned` (which finally gives that
field its first reader — today it is serialized into both system prompts and used by
neither). `intake.budget` is `low|medium|high` but `Product.priceTier` is
`budget|mid|premium`: write the mapping explicitly, don't cast.

The real cost is the catalog. There is no data and no importer; a hand-curated seed
across the seven categories is enough to ship and is also the thing that goes stale.
`Product.regions` holds ISO codes but `IntakeResponse` has no region field, only an
optional free-text `location` — either add one or ship single-region and say so.
Affiliate links in `Product.url` mean the disclosure in
`packages/shared/src/legal/content.ts` has to be revisited.

### 2. Daily checklist
Tappable steps on `/today` with a date-keyed log, stored the same way as `plan.json`.
Do not assign specific weekdays to a 3x/week step — there is no basis for choosing
Monday, and a wrong-feeling schedule is worse than none; count against
`frequencyPerWeek` instead ("2 of 3 this week"). Render `rampSchedule`, which the
pipeline generates and the UI currently discards. No streaks: a missed day in
skincare is normal, and a broken streak is how the app gets deleted.

### 3. Re-scan entry point
`/compare` and the ghost overlay are both built and both unreachable — the only route
into `/onboarding/photo` is `sign-up → age → (consent) → photo`, so no user can ever
reach a second session. A "Take new photos" action on `/today` that starts a session
directly is what makes the work in the last commit visible. Surface it on a cadence
(~4 weeks, from `listSessions()[0].capturedAt`) rather than permanently, and note that
only `illuminant: "screen_flash"` captures are comparable across sessions.

### 4. Paid tier
Free keeps the first scan, the routine and the checklist — that is the proof the
product works. Paid is re-scans and progress history: the value that accrues, and the
part that actually costs money (two sequential Opus calls, roughly $0.08–0.10 a plan).
StoreKit / Play Billing works without accounts, which keeps photos on-device.
Before charging anything, enable prompt caching — `ASSESSMENT_SYSTEM` and
`ROUTINE_SYSTEM` are stable prefixes and are not cached today.

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

## Housekeeping

### Marketing and app parity
Onboarding is now photo-first, which matches `apps/web/components/sections/HowItWorks.tsx`
and `FeatureCards.tsx`. Check no other marketing copy still describes an order
the app no longer uses.

### `/api/plan` is unauthenticated and unmetered
The route's own comment calls it a trust boundary, and it is: no auth, no rate limit,
no key, in front of two paid Opus calls, with `EXPO_PUBLIC_API_URL` shipped in the
client bundle. `body.intake` is checked for presence and passed through otherwise
unvalidated. This needs a rate limit before any real traffic — it is the thing that
turns a launch into a bill.

### `apps/web` has no tests
`packages/shared` is the only package with a test suite. The `/api/plan` input
validation in `apps/web/app/api/plan/route.ts` is a trust boundary in front of a
paid endpoint and is currently only covered by manual probes.
