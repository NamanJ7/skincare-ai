# Guided Routine Session — implementation and QA

## Shipped behavior

- Home and Routine can start or resume a full-screen, one-step-at-a-time session.
- Home and Guided Mode include only steps scheduled for the local date.
- Routine keeps the full plan visible and marks non-due steps with the next scheduled weekday.
- Frequencies from 1–7 times weekly use deterministic, schedule-anchored placement.
- Step identities are occurrence-aware while the first duplicate retains its legacy key.
- Done, skipped, navigation, start, finish, and active-session state persist locally.
- Skip reasons are stored locally. A not-owned skip also updates existing ownership state.
- A resolved session is a full completion only when every scheduled step is done.
- Sessions resume for six hours; a PM session crossing midnight retains its start date.
- A routine-fingerprint change stops stale guidance and offers a current-routine restart.
- Product names, active names, and skip reasons are excluded from session analytics.

## Automated evidence

- Weekly schedule placement, repetition, date boundaries, frequency normalization, and fingerprints.
- Duplicate instance keys and preservation of the first legacy key.
- Done/skip exclusivity, partial resolution, finish semantics, midnight completion, and expiry boundaries.
- Safe normalization of legacy logs and malformed additive schedule/session state.
- Scheduled quick checks use the same keys and totals as Guided Mode.

## Manual release checks

1. Start from Home and complete every scheduled step.
2. Start from Routine, skip one step, and verify partial-completion copy without a streak celebration.
3. Close halfway, terminate the app, reopen, and resume at the last persisted position.
4. Edit a plan-affecting profile answer during a paused session and restart from the stale-session notice.
5. Edit only a mapped product and verify the schedule anchor stays unchanged.
6. Complete a step with a Home quick check and verify Guided Mode shows it as done.
7. Exercise no-product and not-owned paths.
8. Verify the full session remains scrollable at the largest Dynamic Type setting.

Native notification, lifecycle, reduced-motion, and full accessibility signoff remain Session 4 work.
