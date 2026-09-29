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

## Browser run (2026-09-28)

The web build of the app was driven in headless Chromium, with a completed
onboarding profile preloaded into storage. A page reload stood in for killing
and relaunching the app. These all passed:

- The guided routine resumes at the right step after a relaunch.
- A routine can be completed offline, and the completion is saved.
- A reminder for a routine already finished today shows the quiet completed
  state and does not start a duplicate session.
- A reminder for the other period closes the live session and keeps its
  recorded steps.
- Minimum Mode Apply survives a relaunch with Undo still offered. Undo clears
  the change and marks the history entry.
- A failed save keeps the screen in place, shows the retryable error, and
  advances once storage recovers. This holds for both the guided step and Apply.
- "Delete my data" removes the log, reminders and the analytics outbox.
- The page throws no uncaught errors.

The run found two bugs, both fixed:

1. The step-focus call threw on web, where `sendAccessibilityEvent` does not
   exist.
2. A failed Minimum Mode Apply showed its error inside the banner that is
   hidden when nothing was applied.

This is a browser, not a phone. Notifications, haptics, VoiceOver/TalkBack,
Dynamic Type, lock/unlock and a real process kill are still open in the manual
matrix above.

## Follow-up pass (2026-09-29)

- **Tap targets and labels.** I measured every control on seven screens:
  Home, Home with the Recovery suggestion card, the Routine tab, a guided step,
  the skip sheet, the review screen, and completion with the reaction sheet.
  All but one were at least 44pt and labelled. The card's dismiss control
  (34×36, relying on `hitSlop`) is now a real 44×44 target.
- **Colour.** Step status is always given as text next to an icon with its own
  shape ("Done", "Skipped", "n completed · n skipped"). No meaning relies on
  colour alone.
- **Reading order.** Controls follow the visual order. The absolutely
  positioned close and dismiss buttons come last, after the content they
  belong to.
- **Keyboard.** No text entry on these surfaces, so the keyboard cannot cover
  a control.
- **Recovery Mode applied from Home.** Tested with a seeded mild reaction after
  a salicylic-acid routine: the suggestion shows, Apply saves and lands on the
  Routine tab with Recovery on and Undo offered, and Undo clears it.
- **Scheduled reminders after "Delete my data".** Deletion resets reminder
  settings to opted out. `effectiveReminders` then returns nothing, and
  `reconcileScheduled` cancels all four identifiers.
- **Clock changes.** The resume window is elapsed time, so daylight saving and
  timezone changes do not move it, and the session keeps its original date.
  `routine-session.test.ts` covers both.
- **Duplicate notification taps after a restart.** Deliberately not persisted.
  The OS response is cleared once handled. If the app dies before the clear
  lands, the replayed tap resolves through `routineSessionEntry` to resume or
  completed, so it cannot create a duplicate session or record anything.
- **Performance.** Reviewed; no change. The session screen's per-render work is
  small pure functions over a handful of steps. The only new re-render is one
  per return to the foreground.

**Needs a real device (cannot be done from a cloud container):**

- notification taps with the app in each state;
- lock/unlock and incoming calls;
- a true process kill and relaunch after an OTA update;
- haptics feel;
- VoiceOver and TalkBack;
- largest Dynamic Type;
- dark mode, increased contrast and Reduced Motion on the OS.
