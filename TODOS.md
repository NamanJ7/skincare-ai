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

The mechanism to pull real numbers now exists: `apps/mobile/src/lib/photos.ts`
persists the raw `scoreFrame()` metrics and illuminant estimate into each
session's `manifest.json` (version 2) instead of discarding them, and the
capture-review screen shows the same numbers in a `__DEV__`-only caption. Still
needed: actually capturing on real devices across the tone range and adjusting
the constants — this is data plumbing, not calibration.

### Verify `flash="screen"` on device
`apps/mobile/src/app/onboarding/photo.tsx` sets `USE_NATIVE_SCREEN_FLASH = true`.
`'screen'` is a documented SDK 56 `FlashMode`, but the docs do not describe its
front-camera behaviour, and it has not been confirmed on hardware. Check on both
platforms. If it is a no-op, flip the flag to `false`: the app then paints its
own white overlay for a tone-aware duration around the shutter and records the
photo as `ambient` rather than claiming a controlled illuminant it did not have.

The verification procedure is now documented next to `USE_NATIVE_SCREEN_FLASH`:
capture a dim-room session with the flag on, another with it off, and compare
`metrics.meanLuma` between them (now persisted per Stream 3.1 above). Still
needed: someone with a physical device actually running that comparison — this
sandbox has none.

### Screen-flash intensity per tone
A flash level that exposes fair skin correctly will clip its highlights and
underexpose deep skin. Intensity should follow the declared tone.

Built: `packages/shared/src/vision/flash.ts` exports `flashIntensityForTone`,
applied to the JS white-overlay fallback's duration (`apps/mobile/src/app/onboarding/photo.tsx`,
replacing the old fixed `FLASH_MS`). Numbers are provisional — seeded from the
same reasoning as `CAPTURE_TUNING`'s tone profile, not measured. See
`flash.test.ts` for the mechanism tests (monotonic by tone, bounds-checked).

Confirmed via the SDK 56 source (`Camera.types.ts`), not assumed: the native
`flash="screen"` mode is a discrete `'off' | 'on' | 'auto' | 'screen'` enum with
no numeric intensity control, so the native path cannot honor tone-aware
intensity today — it stays at its current unconditional near-max behaviour.
Open product decision: deprioritize the native path in favor of the
always-controllable JS overlay, or leave native flash intensity unaddressed
until Expo exposes a level control.

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

Done: per-session delete. `apps/mobile/src/lib/photos.ts` exports
`deleteSession(id)`/`photoCountForSession(id)`; the "Your photos" card on
Today lists each session (once 2+ exist) with a delete action, confirmed the
same way as the existing "Delete my photos" button.

Still open, and deliberately not decided here: a retention-cap policy (auto-
prune sessions older than N days, or beyond the last N) — no cap number was
specified anywhere, so none was invented. A product call, not an engineering
one.

The ghost overlay itself is unverified on hardware — same caveat as
`flash="screen"` above: confirm the oval-clipped ghost image actually reads as
"line up with your last photo" on a real front camera before calling this
done-done.

## Housekeeping

### Marketing and app parity
Onboarding is now photo-first, which matches `apps/web/components/sections/HowItWorks.tsx`
and `FeatureCards.tsx`. Check no other marketing copy still describes an order
the app no longer uses.

### `apps/web` has no tests
Done. `apps/web` now has vitest (`apps/web/vitest.config.ts`, `pnpm --filter web
test`) and `apps/web/app/api/plan/route.test.ts` covers the full validation
chain plus two mock-mode success cases. While writing it, found and fixed a
real gap it was meant to guard against: `intake` had no structural validation
(only a truthiness check), so a malformed request 500'd instead of 400ing on a
paid endpoint — `IntakeResponseSchema` in `apps/web/lib/schemas.ts` (mirroring
the existing `PhotoQualitySchema` pattern) closes it.
