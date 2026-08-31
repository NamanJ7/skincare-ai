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
session's `manifest.json` (version 3, which also now records the session's
declared `tone` — needed to group captures by tone band at all) instead of
discarding them, and the capture-review screen shows the same numbers in a
`__DEV__`-only caption.

`scripts/calibrate-capture-tuning.mjs` (`pnpm calibrate:capture -- <dir>`)
turns a folder of pulled manifests into per-tone/per-illuminant statistics
and a suggested `minMeanLuma` per tone, so the remaining step is arithmetic a
script does, not arithmetic a person does by hand. Self-tests with
`--self-test` (no device or fixture files needed to verify the aggregation
logic itself).

Still needed, and still genuinely un-automatable from here: actually
capturing on real devices, by real people, across the full tone range. No
amount of additional code substitutes for that data existing.

### Verify `flash="screen"` on device
`apps/mobile/src/app/onboarding/photo.tsx` sets `USE_NATIVE_SCREEN_FLASH = true`.
`'screen'` is a documented SDK 56 `FlashMode`, but the docs do not describe its
front-camera behaviour, and it has not been confirmed on hardware. Check on both
platforms. If it is a no-op, flip the flag to `false`: the app then paints its
own white overlay for a tone-aware duration around the shutter and records the
photo as `ambient` rather than claiming a controlled illuminant it did not have.

The verification procedure is now documented next to `USE_NATIVE_SCREEN_FLASH`:
capture a dim-room session with the flag on, another with it off, and compare
`metrics.meanLuma` between them. `scripts/calibrate-capture-tuning.mjs` now
does this comparison automatically (its "Flash verification" section, grouped
by tone, flags a lift under 5 units as a likely no-op) once manifests are
pulled off a device. Still needed: someone with a physical device actually
running the capture and pulling the files — this sandbox has none.

### Screen-flash intensity per tone
A flash level that exposes fair skin correctly will clip its highlights and
underexpose deep skin. Intensity should follow the declared tone.

Built: `packages/shared/src/vision/flash.ts` exports `flashIntensityForTone`
(`level` 0..1 + `durationMs`), applied in `apps/mobile/src/app/onboarding/photo.tsx`.
Numbers are provisional — seeded from the same reasoning as `CAPTURE_TUNING`'s
tone profile, not measured. See `flash.test.ts` for the mechanism tests
(monotonic by tone, bounds-checked).

Confirmed via the SDK 56 source (`Camera.types.ts`), not assumed: the native
`flash="screen"` mode itself is a discrete `'off' | 'on' | 'auto' | 'screen'`
enum with no numeric intensity prop. Rather than wait for Expo to add one,
intensity is now applied a level below that API: `expo-brightness`'s
`setBrightnessAsync` (also confirmed against its SDK 56 source — no
permission needed, app-scoped) sets the actual screen brightness to the
tone's target `level` before every shot and restores it after, for both flash
paths, since both are the same "flood the display, camera catches the
reflection" mechanism at different points in the stack.

Still open: whether raising app-level brightness actually changes the native
`flash="screen"` mode's own output (as opposed to only the JS overlay, whose
effect is unambiguous since it paints the same screen). That can only be
confirmed on a physical device — see the manual verification procedure above,
which should now also compare `metrics.meanLuma` across tones, not just
flash-on vs. flash-off, since intensity is tone-aware.

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
