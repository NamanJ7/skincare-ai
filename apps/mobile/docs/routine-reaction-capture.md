# Routine Reaction Capture — implementation and QA

## Shipped behavior

- Guided full and partial completions open one optional post-routine question.
- Home and Routine quick-check completions open the same reusable question.
- Comfortable, tight/dry, mild discomfort, serious discomfort, and Skip are one-tap actions.
- Answers and dismissals persist on the local date-and-period routine log.
- A persisted answer or dismissal prevents the prompt from repeating for that period.
- Guided and Routine completion views can reopen the prompt to add or change an answer.
- Tight/dry makes Minimum Mode eligible; mild discomfort prefers Recovery Mode only when the completed routine contained a strong active.
- A serious self-report suppresses ordinary routine coaching and uses the existing professional-care card.
- Suggestions remain user-controlled and never mutate the routine automatically.
- Reaction analytics contain only period and completion source, never the selected answer.
- Reaction data remains separate from check-ins, scans, Skin Status, and weekly trend comparisons.

## Automated evidence

- Valid reaction and dismissal fields normalize additively while malformed additions are dropped without losing routine history.
- Answers can be replaced, Skip persists, and prompt eligibility respects both states.
- Latest-reaction lookup uses local calendar windows and derives strong-active context from scheduled step identities.
- Comfortable produces no reaction suggestion; tight/dry and mild discomfort select the expected coaching mode.
- Serious self-reports suppress normal adjustment coaching.
- Reaction data leaves routine completion and consistency calculations unchanged.

## Manual release checks

1. Completed the Home quick-check path and verified the reaction sheet opened exactly at period completion.
2. Verified all labels and the self-reported-experience accuracy copy at the web preview's mobile viewport.
3. Selected a serious self-report and verified the professional-care card replaced ordinary coaching.
4. Reloaded the preview and verified the saved reaction and escalation remained.
5. Completed a guided routine with one done and one skipped step and verified the sheet opened after partial resolution.
6. Chose Skip and verified the completion screen offered an explicit add-response action without reopening the prompt.

The feature adds no notification, lifecycle, permission, or native-only interaction. The iOS bundle export and web preview both pass; full physical-device release validation remains Session 5.
