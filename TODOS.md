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

### ~~The user cannot see the ramp being held~~ — done
`rampProgress` now reports `heldByFlare` alongside the week, and the evening
session carries a `ramp_held` note explaining it. Only the most recent completed
week counts, so a flare five weeks ago is not offered as an explanation for
tonight. Covered by `schedule/engine.test.ts`.

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

### ~~Marketing and app parity~~ — done, and it was worse than an ordering problem
The site sold two features that did not exist anywhere: a "product shelf" (listed
as a *free-tier* feature in `lib/pricing.ts`) and "smarter product guidance" with
a routine-fit signal. It also said mobile was "coming soon" while a complete Expo
app sat in this repo, depicted a web dashboard with a "My shelf" tab, and
described "a picture" when the app takes three under a controlled illuminant.
All of it now describes what actually ships — capture as an instrument, the
deterministic clamp, the pacing, and a comparison the product refuses to fake.
`packages/shared/src/types/product.ts` was imported by nothing and is deleted.

Two things deliberately left as claims about the future, clearly marked: the
store badges ("not on the app stores yet") and the paid tiers. A FAQ entry now
answers "does Pore recommend specific products to buy?" with "not today".

### `apps/web` has no tests
`packages/shared` is the only package with a test suite. The `/api/plan` input
validation in `apps/web/app/api/plan/route.ts` is a trust boundary in front of a
paid endpoint and is currently only covered by manual probes.

## Landed in the refinement pass, still unverified on hardware

Everything below typechecks, has unit tests where it is deterministic, and
bundles through `expo export --platform web`. None of it has been in a hand.

### Haptics
`apps/mobile/src/lib/feedback.ts` wraps `expo-haptics` (new dependency, pinned to
the SDK 56 line). Attached to: ticking a step, finishing a session (a heavier
success), every `Chip` selection (in the primitive, not at the call sites), and
the capture quality gate passing vs rejecting — those two look identical at arm's
length with the screen lighting your face and mean opposite things. Confirm the
session-complete success does not feel like a reward loop.

### Native headers
`_layout.tsx` turns the platform header on per-route, chevron only, because four
screens had no back affordance and the ones that did hand-rolled it. Check the
header does not crowd the screens that open at `spacing.section`, and that the
camera and landing stay full-bleed.

### The allergy step
Onboarding is five questions now, not four. The fifth needs a real look: whether
"Nothing I know of" reads as a valid answer rather than a skip, and whether nine
ingredient chips is a wall of jargon to someone who has never used an active.

### Reduce-motion
The splash is skipped entirely and the hero loop parks on its results frame.
Verify against the OS setting on both platforms — this is the one behaviour that
cannot be checked from a bundle.
