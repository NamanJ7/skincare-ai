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
Done: `apps/mobile/src/lib/reminder.ts` schedules one local daily notification at
an hour the user picks at the end of onboarding, with the off switch on `/plan`.
It deliberately does **not** name tonight's active. A `DAILY` trigger is
scheduled once and fires unchanged, so "Retinoid night" would be wrong on the
four nights a week it isn't one — and worse, a `stinging` check-in deloads the
routine and renames the session, so the banner could be falsified by the user's
own report between scheduling and firing. The body says the routine is ready; the
headline lives on the screen it opens, computed fresh.

Unverified on hardware: whether the permission prompt at the end of onboarding
converts, and whether 7-10pm are the right four options.

### The user cannot see the ramp being held
Done: `rampState` in `packages/shared/src/schedule/engine.ts` now returns the
hold count alongside the week, `planDay` emits a `ramp_held` `ScheduleNote` on the
evening session, and `WeekPlan` carries `rampWeeksHeld`. Six cases in
`schedule/engine.test.ts` cover it, including the two silences that matter: no
`ramp_held` during a deload (the deload note already explains the lighter night,
and two explanations for one thing teaches the user to read neither) and none at
full strength.

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
Resolved, but not by picking one clock — they measure genuinely different things
(the gap between two photo sets vs. time on the routine), and forcing them to
match would make one of them wrong. The `/compare` subtitle now names what its
number spans: "N weeks between these two photo sets". The numbers can still
differ; they no longer look like the same fact contradicting itself.

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

## Deferred from the app-improvements pass

A review of the mobile app produced ten items. Six shipped on
`claude/skincare-app-improvements-ygc6za`; these four were deliberately held back
for a second pass, because they are hierarchy and composition work that is much
better judged against a build you can hold than against a description.

### `/plan` is a document dump, not a receipt
Nine stacked `Card`s at identical visual weight: what we noticed / what we
couldn't see / see a professional / morning / evening / what we adjusted / your
photos / your record / your answers / legal. It buries the one thing no
competitor can copy. The full evidence chain already exists in code and is
currently scattered across four screens as grey bullet lists:

```
photo quality + illuminant -> assessment + per-concern confidence
  -> SafetyAdjustment[] -> ScheduleNote[] -> tonight
```

Present it as one artifact: the routine first, the reasoning one tap under it,
the rest behind progressive disclosure. This wants close to zero new logic — it
is composition and hierarchy. If it starts needing a new engine or a new domain
type, it has gone wrong.

### The week strip should be the navigation
`WeekStrip` renders seven dots you cannot touch, while `planWeek` already returns
a full `DayPlan` for all seven days — the data is there and unused. Meanwhile the
AM/PM switch is a `GhostButton` at the bottom of `/today`, below the week strip
and the check-in, after a full scroll. Tap a day to see that day, tap today to
toggle AM/PM, delete the button. One fewer control, strictly more capability.

### `/compare` is still hard to reach
`/today` now offers a re-capture once the ramp completes, which is the first path
that does not require going through `/plan` -> "Your photos" -> "See what
changed" and knowing about an unstated `sessionCount >= 2` condition. That is a
start, not a fix. The verdict screen is the retention payoff and the whole bet of
the product — that "we couldn't measure this" reads as integrity rather than
breakage — and that bet is untested while most users never reach the screen.

### Dynamic Type, chip semantics, reduced motion
`AppText` sets fixed `fontSize` from tokens against fixed-height layouts (56px
step rows, a 26px `CheckCircle`, 10px week-strip dots). At 150-200% Dynamic Type
this breaks; the worst offender is the sensitivity step in
`onboarding/intake.tsx`, which puts "Somewhat - Some products sting or make me
red" inside a single pill `Chip`. `Chip` also has no `accessibilityRole` or
`accessibilityState`, so every selection in onboarding — goals, skin type,
sensitivity, allergies, reminder hour — is invisible to a screen reader. That
last one is the cheapest fix on this list and should probably not wait.

`CheckCircle` already honours `useReducedMotion`; nothing else in the app animates
yet, but anything added in the `/plan` rework must.

### Not proposed, on purpose
A product/SKU catalog. `packages/shared/src/types/product.ts` defines `Product`
and `StepRecommendation` and both are dead code. A curated catalog is real
liability and real maintenance, and "use what you already own" — asked on `/plan`
after the user has a routine, never as another onboarding step — is the simpler
product and the better one. `IntakeResponse.currentProducts` is still hardcoded
`[]` in `apps/mobile/src/lib/intake.ts` and is the remaining half of that item.

Also not proposed: a streak-maximising retention layer. The consecutive-day
streak that used to sit on `/today` was replaced with a count of sessions this
week, because an unbroken chain punishes the one behaviour the deload engine
exists to encourage — stopping when your skin says stop.

## Housekeeping

### Marketing and app parity
Onboarding is now photo-first, which matches `apps/web/components/sections/HowItWorks.tsx`
and `FeatureCards.tsx`. Check no other marketing copy still describes an order
the app no longer uses.

### `apps/web` has no tests
`packages/shared` is the only package with a test suite. The `/api/plan` input
validation in `apps/web/app/api/plan/route.ts` is a trust boundary in front of a
paid endpoint and is currently only covered by manual probes.
