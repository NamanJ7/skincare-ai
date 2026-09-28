# Daily loop hardening (Session 4)

## Shipped behavior

- AM and PM reminders open the Guided Routine directly
  (`/routine-session?period=…&source=reminder`). Weekly opens check-in and
  sunscreen opens Home (`reminderHref` in `src/lib/reminders.ts`).
- Taps route only after local state has loaded. The root layout does not render
  providers or `RetentionEffects` until profile, log and reminders are hydrated,
  and the cloud fill (`pullMissingSnapshots`) is capped at 3s.
- A repeated delivery of the same response is ignored: the response key is
  remembered and the last response is cleared from the OS.
- A tap while Guided Mode is already open retargets that screen with
  `setParams`, so the stack never holds two copies.
- Opening Guided Mode resolves through `routineSessionEntry`
  (`src/lib/routine-session.ts`):
  - an expired session closes without becoming completed or skipped history;
  - a live session for the notified period resumes, including a PM session
    that crossed midnight;
  - a live session for the other period is closed and the notified routine
    starts. Its step outcomes stay in the day log, so nothing is lost, and a
    later start of that period resumes them. There is no chooser dialog.
  - a period already finished today shows a quiet completed state instead of a
    second session;
  - otherwise a new session starts only when something is due.
- A session whose start sits more than 5 minutes in the future (clock set
  backwards) counts as expired rather than resuming forever.
- The screen re-renders on return to the foreground, so midnight and the
  six-hour window are re-evaluated against the real clock.
- Haptics: light impact on Done, selection on skip reasons and reaction
  answers, success only when every scheduled step is done. Haptic failures are
  swallowed and never block a save.
- Accessibility: the step heading is a header and receives screen-reader focus
  after each transition. Save failures and completion are announced through
  `announceForAccessibility`, as well as through live regions for Android.

## Automated evidence

- `routine-session.test.ts`: the entry table (resume across midnight, switch,
  unspecified period, expiry first, completed, start/none), clock-backwards
  expiry, and that closing a switched-away session keeps its outcomes.
- `reminders.test.ts`: reminder destinations.

## Not automated

The mobile package has no component test runner. Focus movement, announcements,
Reduced Motion and haptics feel are covered by the manual matrix below.

## Manual matrix (not yet run on hardware)

For each item, test on an iPhone and one Android device:

1. Tap the AM, PM, weekly and sunscreen reminders with the app in each state:
   foreground, background and killed.
2. Lock and unlock mid-session.
3. Kill the process after each of Done, Skip, Next/Prev, Finish, reaction, and
   resume.
4. Cross midnight with a PM session open, then tap a PM reminder at 00:30.
5. Return after more than six hours.
6. VoiceOver and TalkBack: focus lands on each new step heading; save errors and
   completion are spoken.
7. Largest Dynamic Type, dark mode, increased contrast, Reduced Motion.
8. Airplane mode: start, complete, react.

## Known limits

- Date attribution is calendar midnight app-wide (`todayKey`). A PM routine
  *started* after midnight is recorded on the new day. Only a session already
  open crosses midnight on its original date.
- Coaching Apply/Undo (Session 3, `docs/coaching-apply-undo.md`) persists
  through the same awaited write path, and its history is erased with the log.
