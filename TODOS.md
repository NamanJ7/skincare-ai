# TODOS

Deferred work that is real. If it is not written here, it does not exist.

## Marketing and product have drifted apart

Three claims on the marketing site are not true of the app, and each needs a decision rather than a
patch. None is fixed by the current branch.

### The pricing page charges for things that are free and shipped
`apps/web/lib/pricing.ts` puts "Measured before / after" and "Routine adapts to what changed" behind
**Pore Plus**. Both are `packages/shared/src/progress`, both are shipped in the mobile app, and both
are free — there is no auth, no payments and no server, so no gate is possible even in principle.
`PRICING_FAQ` also commits, in writing, that the Free plan stays free "with no time limit".
Either build the gate (accounts + payments + a backend, which contradicts the privacy content that
is currently the strongest thing about the product) or rewrite the tiers to describe what is
actually differentiated. Do not leave a page up that sells a paywall that cannot exist.

### "Advanced compatibility checks" does not exist in any form
Sold on `/features`, mocked in `apps/web/components/mockups/CompatibilityMock.tsx` (a pairwise grid
with "Works well together" / "Space to alternate nights"), and priced as a Plus feature. There is no
pairwise compatibility logic in `packages/shared`. The safety engine knows three booleans per active
(`isExfoliatingAcid`, `isRetinoid`, `isBenzoylPeroxide`) — a classification, not a graph.

It is the most obviously *right* next feature for this codebase: deterministic, unit-testable, pure
`packages/shared`, no SKUs and no backend, and it is the only thing that would give someone a reason
to open the app that is not "tick a box". It is also the one honest use for
`IntakeResponse.currentProducts`, which is still inert. The blocker is that twelve actives with
eight booleans each is not enough to answer a real question, so the `ACTIVES` table has to grow
first. Not started.

### The store badges are not links
`apps/web/components/sections/AppDownload.tsx` renders App Store and Google Play badges as inert
`<div>`s. There is no published build. Until there is, the badges are a promise the funnel cannot
keep.

## Before launch

### Tune `CAPTURE_TUNING` on real devices
`packages/shared/src/vision/quality.ts` ships thresholds seeded from theory, not
from this product's camera. Exposure floors, the sharpness threshold and the
skin-coverage minimum all need to be measured against real captures **across the
full skin-tone range** and adjusted. A real front camera under real light will
not match the paper. The regression test in `quality.test.ts` locks in the
behaviour that matters (a correctly exposed deep-skin capture must not be called
"too dark"); the numbers around it are still provisional.

### The illuminant is now measured, not declared
Done, and the framing this entry used to carry was wrong twice over. It claimed
the SDK docs "do not describe front-camera behaviour" for `flash="screen"` —
they do: the SDK 56 docstring says it uses the device screen as a flash for
front-camera selfies, via CameraX on Android and Retina Flash on iOS. And it
filed the whole thing as a config detail, when the real problem was one no
device check could settle.

The label was a *declaration*. `photo.tsx` set it from a compile-time constant,
`photos.ts` passed it through untouched, and `isMeasurable` in the progress
engine trusts it as the only gate on whether two sessions may be subtracted.
"We asked for a flash" and "our light actually dominated this frame" are
different claims, and they come apart in daylight: a screen flash contributes
nothing measurable outdoors and a great deal in a dark bathroom, so two sessions
shot in those two places are not comparable even if the flash fired perfectly
both times.

Now: `shoot()` captures an ambient reference frame (`skipProcessing`, so it is
cheap, and orientation does not affect a mean) before any of our light is on,
`processCapture` takes its mean luma, and `classifyIlluminant` in
`vision/quality.ts` decides the label from the ratio against the lit frame.
Six cases in `quality.test.ts` cover it, including the two that matter: daylight
must not be called a flash, and a near-zero reference must not manufacture one
out of a dark frame. The bias is toward `ambient` throughout — a wrong `ambient`
costs a comparison, a wrong `screen_flash` invents one.

`flash="screen"` was dropped in the process. Not because it does not work, but
because there is no way to capture an unlit reference while the camera sits in a
flash mode without toggling a prop mid-shutter and hoping the change lands. The
app paints its own overlay instead, which keeps the capture path linear.

**The open question that replaces this one:** is the app-painted overlay bright
enough? A plain white `View` at whatever brightness the display happens to be on
is weaker than Retina Flash. If device testing shows captures classifying
`ambient` indoors — visible as `/compare` refusing to compare — the fix is to
raise the display to full brightness for the duration of the flash
(`expo-brightness`), **not** to go back to claiming light that was never
verified. The measurement makes that testable: the classification rate is the
signal.

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

### ~~Only two assessments are ever kept~~ — every reading is kept now
Done. `journal.assessments` is an ordered array; `baseline` is element zero and
still write-once, `latest` is the last element. The migration off the old
two-slot shape lives in `packages/shared/src/progress/history.ts` with 11 tests,
deliberately not beside the app's storage: a migration that silently drops a
baseline is indistinguishable from a working one until the comparison it ruins.

`recordInHistory` replaces in place when the same `sessionId` is re-filed, so a
retried assessment of one capture set is a correction rather than a second point
in time — otherwise any trend drawn from this would carry a fake interval.

**Still open**: nothing draws the trend yet. `/compare` remains baseline vs
latest, which is the right verdict surface; a per-concern line over 3+ points is
now possible and is not built. Retention is also still unsolved — the history
grows without bound, same gap as the photos below.

### Re-assessment burns a full plan generation
`runReassessment` calls `buildPlan` (which calls `fetchPlan`), running *both*
model calls and throwing the returned routine away — only `.assessment` is used. That is a deliberate trade:
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

### `IntakeResponse.currentProducts` is inert
Cut, not deferred. A grep across `packages/shared/src`, `apps/web/lib` (the
pipeline and both prompts) and `apps/mobile/src` finds it only ever *written* as
`[]` — in `buildIntake` and three test fixtures. No engine reads it and neither
prompt mentions it, so collecting it would produce a "you already own this" label
that changes nothing about the generated routine. That is the decorative
personalisation this product otherwise refuses to ship.

Two honest ways to revive it, both bigger than a UI affordance: change
`ROUTINE_SYSTEM` so the model prefers steps the user already owns, or have the
safety engine treat an owned product as a reason to keep a step. Until one of
those exists, leave the field alone rather than collecting data nothing consumes.

### `/plan` is a document dump, not a receipt
Done. It was twelve stacked `Card`s at identical visual weight — what we noticed
/ what we couldn't see / see a professional / morning / evening / what we
adjusted / photos / record / reminder / answers / legal — which buried the one
thing no competitor can copy. It is now a header, the routine, and two
`Disclosure` sections:

```
photo quality + illuminant -> assessment + per-concern confidence
  -> SafetyAdjustment[] -> tonight
```

"Why this routine" collapses that whole chain in causal order; "Your data"
collapses the photos, the record, the reminder and every erase path. The
escalation cue is deliberately **not** collapsed — a safety cue behind a tap is a
safety cue that does not exist. No new logic, no new domain types.

The `Disclosure` primitive in `theme/ui.tsx` has no height animation on purpose:
mounting the children when open is the whole job, and skipping the tween also
skips the reduced-motion question.

### The week strip should be the navigation
Done. `WeekStrip` takes `selected` and `onSelectDay`; each day is a `Pressable`
with a role, a selected state and a label carrying the weekday plus that day's
evening headline. `/today` holds a `viewingDate`, reset on focus, and the
"Show tonight instead" button is gone — tapping the day already open flips
morning/evening.

**A future day is preview-only, and that is load-bearing.** Journal entries are
keyed by calendar date, and both `adherenceRate` and `rampWeekFor` read back from
them, so ticking Thursday off on Monday would advance the ramp on a claim that
had not happened. Four things stop it: `onToggle` and `onFeel` return early
unless `isToday`, the step rows are `disabled`, the check-in card is not
rendered, and both writes target `date` rather than `viewingDate` so even a
bypassed guard could not reach a future day. `planWeek` also runs against today
rather than the viewed day, so browsing cannot make the ramp week jump.

Back-filling yesterday is deliberately **not** supported. It would inflate the
adherence rate, which gates whether the routine is allowed to get *stronger*; the
existing comment in `journal.ts` is explicit that under-counting is the safe
direction to be wrong in.

### ~~`/compare` is still hard to reach~~ — and the six-week wait is gone too
Done. `/today` links to it once two capture sessions exist, and the re-capture
invitation is no longer gated on the ramp reaching full strength: `recheckDue`
(`FIRST_RECHECK_WEEK` = 2, then every 4) runs off the last capture date instead.
Six weeks of identical screens before the only thing that ever unlocked was not a
loop anybody stays in. `plan.tsx` also lifts "Take a new set" out of the
collapsed "Your data" accordion to a top-level card — filing the core loop under
data management is how a feature stops existing.

`scheduleRecheck` in `reminder.ts` books one dated notification when a set comes
due, so the product can finally ask for the thing it is built around instead of
waiting to be discovered.

What is still untested is the bet itself: whether "we couldn't measure this"
reads as integrity or as the app looking broken. `/compare` now hedges it by
rendering the before/after photographs above the verdict and unconditionally —
a record claims nothing, so it survives a refusal — but whether that lands is a
question for people, not code.

### Dynamic Type
Done, and smaller than it was written up to be. A re-audit found four of the
claimed breakages were not breakages at all: `minHeight: 56` on the step rows is
a floor and grows; `CheckCircle` and `ProgressDots` contain no text; `Chip` sits
in a `flexWrap` container and the pill grows; and the `WeekStrip` letters are
single characters — a 14pt glyph at 200% is 28pt in a column that is ~39pt wide
on the narrowest phone.

Two were real and are fixed:

- The sensitivity step packed "Somewhat - Some products sting or make me red"
  into one `Chip`. A pill is built for two or three words. It is now an
  `OptionRow` — a full-width label with the hint under it, growing downward
  rather than sideways — which was a design bug at 100% too, not only at 200%.
- Display type had no ceiling. iOS accessibility sizes reach roughly 310%, which
  turns the 40pt hero into ~124pt. `AppText` now caps the display ramp at 1.6x
  and leaves body, caption and label uncapped, since a large paragraph is still
  a readable paragraph and a screen-filling headline is not.

What is still unverified is the same thing as everywhere else: nobody has turned
the slider up on a real device and looked.

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

## From the trust-and-retention pass

### ~~The safety profile could not be corrected~~ — done
Sensitivity, the pregnancy flag and declared allergies are the three inputs
`applySafetyRules` leans on hardest, and all three change over a life. The only
way to correct any of them was "Erase everything and start over" on `/plan`, so a
user who became pregnant had no way to tell the app and the safety engine went on
doing exactly the right thing to the wrong answers — the failure `profile.ts` was
written to prevent, one level up. `onboarding/intake.tsx?mode=edit` now re-opens
the same five questions prefilled and re-runs the engine.

**Known limitation, stated in the UI rather than hidden**: re-clamping is
monotonic. `applySafetyRules` removes and caps and has no path that restores a
step an earlier answer removed, so someone who un-sets the pregnancy flag does not
get their retinoid back — they are told to build a new routine from fresh photos.
A genuine "reconsider this step" would mean a second routine-draft call, which is
a bigger change than an edit screen.

### ~~The baseline could not survive the phone~~ — exportable now
`src/lib/backup.ts` writes `{ profile, journal }` to a file and hands it to the
system share sheet; `importBundle` reads one back and replaces both stores. The
baseline assessment is written once and never replaced, so losing it never cost a
routine — it permanently cost the ability to measure anything again.

**Open**: photos are not in the bundle, deliberately (two orders of magnitude
larger, and the unrebuildable part is the assessment). If people expect their
photos to travel, that needs a zip and a size story. Restore is also a replace
and not a merge — reconciling two journals needs a rule for which tick-off wins,
and any such rule inflates the adherence record that gates whether the routine
may get *stronger*. Unverified on hardware: whether the iOS share sheet and the
Android document picker both behave through `expo-sharing` +
`File.pickFileAsync`.

### ~~The re-assessment could never produce a verdict~~ — fixed
This was the serious one. `runReassessment` in `compare.tsx` built its own
`fetchPlan` payload and omitted each photo's measured `quality`. The pipeline
attaches `photoQuality` to the assessment straight from the request
(`apps/web/lib/pipeline.ts`), and the progress engine's comparability gate is its
only consumer: an angle counts only if it was flagged clean **and** its
illuminant came back `screen_flash`. With the field missing, every re-assessment
landed carrying an empty `photoQuality`, no angle was ever measurable, and the
verdict the entire screen exists for could not be produced — the engine refused
every single time, correctly, for a reason that had nothing to do with the
photos. Both capture paths now go through `buildPlan` (`src/lib/plan.ts`) so the
payload shape cannot drift again.

**Never verified end to end against a real key.** The fix is structurally right
and typechecks, but nobody has watched a real second capture produce a real
comparable report. Do that before trusting any of the progress numbers.

### The auth stubs are gone, and nothing replaces them
`(auth)/sign-up` and `(auth)/sign-in` were deleted. Neither created, checked or
stored anything; the Apple and Google buttons called the same no-op as email;
sign-in let a fresh install straight through to an empty `/today`; and sign-up
promised "save your skin scans and routine, and track your progress over time"
when nothing is saved anywhere but the phone. A screen that asks for a password
it throws away is not a placeholder for accounts, it is a false statement about
where the user's data lives.

Real accounts remain unbuilt and remain the gate on: a baseline that survives a
lost phone without the user remembering to export, any paid tier at all, and real
protection on `/api/plan` (see below). Web `/login` and `/signup` still exist and
are honest — they say "launching soon, waitlist members first".

### Parental consent still is not consent
`onboarding/consent.tsx` records the guardian's email and a `parentConsentAt`
timestamp on the device and sends nothing. The copy now says exactly that rather
than "add their email so we can reach them for approval", which was a claim that
a 16-year-old's parent had been contacted when no code in the app ever contacted
anybody. Verifiable parental consent needs an email service and a server, so it
needs the accounts work above. Until then this is a notice, not a consent record,
and the legal position should be reviewed by someone qualified.

## Housekeeping

### Marketing and app parity
Onboarding is now photo-first, which matches `apps/web/components/sections/HowItWorks.tsx`
and `FeatureCards.tsx`. Check no other marketing copy still describes an order
the app no longer uses.

### ~~`apps/web` has no tests~~ — the trust boundary is covered now
`apps/web` has vitest and 21 tests over the two things guarding a paid endpoint:
`lib/validateImages.ts` (extracted from the route so it could be tested at all)
and `lib/rateLimit.ts`. Everything else in `apps/web` is still untested, which is
fine — it is a marketing site.

### `/api/plan` rate limiting is a speed bump, not a wall
`lib/rateLimit.ts` counts per-IP requests (5 per 10 minutes) and concurrent
generations (4) **in the process**, so on serverless each instance enforces its
own limit and a cold start resets it. `x-forwarded-for` is also spoofable by
anyone talking to the origin directly. It stops the accidental case — a retry
loop, a stuck client, a scraper that does not care — and it is the most that can
be done without shared state. Before this endpoint carries real traffic, move
the counters to Redis/KV; `check()` is pure apart from the store it is handed,
so only the store changes. Real protection means auth on the endpoint, which
means an account system that does not exist yet.

### `/api/plan` still does not validate `intake`
The throttle above closed the volume half of this; the shape half is open.
`validateImages` is thorough about the image array — count, size, media type,
and the client-measured `quality` parsed rather than trusted. `intake` gets none
of that: the body is cast `as Partial<PlanInput>` (a compile-time claim, not a
runtime check) and the route only tests it for truthiness, so any truthy value
reaches `JSON.stringify` in `pipeline.ts` and goes into the prompt verbatim.
`IntakeResponse` carries free-text fields, so this is the field that reaches the
model as text. An `IntakeResponseSchema` in `apps/web/lib/schemas.ts` — which
already mirrors the domain enums for outputs — is the shape of the fix.

### ~~The mobile client cannot see a 429~~ — done
`fetchPlan` returns a discriminated `PlanOutcome`: either the plan, or a
`PlanError` carrying `offline | busy | rejected | unknown` and a `retryable`
flag, with an `AbortSignal.timeout` deadline so a stalled request cannot spin
forever. A 429 maps to `busy`/retryable, and `onboarding/intake.tsx` no longer
navigates onward on failure — it shows what happened and offers a retry that
re-sends the same answers.

The kinds differ slightly from what this entry originally proposed:
`unconfigured`, `offline` and `timeout` are one `offline` kind, because the
person watching the spinner cannot act on the difference, and `rejected` was
added for the one case where retrying is pointless. The endpoint cooperates —
it maps upstream failures to 503 when a retry might work and 500 when it will
not, and its 429 and error responses now carry CORS headers, without which a
cross-origin caller cannot read the status at all and every throttle would look
like being offline.

### CI reports but does not block
`.github/workflows/ci.yml` runs typecheck, test, lint and build on every pull
request, but GitHub will not stop a merge on a red run until branch protection
is enabled on `main` — Settings → Branches → require the
`typecheck · test · lint · build` check. That is a repository setting, not
something a commit can do. Until it is on, the gate is advisory.

### CI's actions still target the deprecated Node 20 runtime
`actions/checkout@v4`, `actions/setup-node@v4` and `pnpm/action-setup@v4` all
declare Node 20 as their JS runtime. GitHub currently force-runs them on Node 24
and prints a deprecation warning on every run; when it stops doing that, the
workflow breaks. The fix is bumping each action to the major that targets Node
24 — deliberately not done blind, because naming a tag that does not exist turns
the gate red for a warning that is not yet failing anything. Check the current
majors and bump them together. (The build itself already runs on Node 22; only
the actions' own runtime is stale.)
