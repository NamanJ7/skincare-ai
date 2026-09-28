# Coaching Apply / Undo (Session 3)

## Shipped behavior

- A coaching suggestion is one of Recovery Mode (`pause_strong_actives`), Minimum
  Mode (`simplify_today`) or a small win (`small_win`). It comes from
  `routineAdjustment` in `src/lib/adjustments.ts`. That function's thresholds are
  unchanged.
- **Apply** waits for the change to be saved before doing anything else. On
  failure the suggestion stays on screen, a retryable error is shown and
  announced, and nothing navigates. This holds on Home (`AdjustmentCard`) and
  for Minimum Mode on the Routine tab (`useAcceptRevision`).
- Applying records what it replaced (`RoutineLog.revisionUndo`): the previous
  revision, and the effective day's log before it was trimmed to the lighter
  routine.
- **Undo** is on the Routine tab's mode banner, and only on the day the change
  took effect. It restores the previous revision and the steps apply trimmed.
  Anything recorded after apply is kept, so undo never erases a saved outcome.
  Undo is one level deep.
- Every apply is logged to `RoutineLog.coachingHistory`, capped at 30 entries.
  Undo marks its entry with `undoneAt`. History lives in the routine log, so
  "Delete my data" and account deletion erase it with the log.
- A Guided Routine session that was open when the routine changed shows the
  existing "Your routine changed" notice. It never continues with stale steps.

## Automated evidence

`src/lib/coaching-undo.test.ts` covers:

- apply, and the history it records;
- undo restoring trimmed steps;
- undo keeping post-apply outcomes;
- undo restoring an earlier revision;
- the one-level, same-day limits;
- the history cap and a storage round-trip;
- malformed stored state being dropped.

## Manual checks

1. Apply Recovery Mode from Home, then undo it from the Routine tab. The
   retinoid comes back, and a step ticked before apply is still ticked.
2. With storage writes failing, Apply shows the error and stays put.
3. Apply, kill the app, reopen: the change and its Undo are still there.
4. VoiceOver: the save error is spoken, and Undo is reachable and labelled.

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
