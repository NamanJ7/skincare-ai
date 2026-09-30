# Session 5 release validation

Session 5 adds browser automation and repeatable native flows. Passing CI is **not**
physical-device signoff. Beta promotion requires the iPhone checks below and an
Android smoke result attached to the release record.

## Automated gates

Every PR runs Expo dependency compatibility, lint, copy and theme audits,
typecheck, unit/integration tests, the mobile web build, the Playwright daily
loop, a beta/production fixture-route denial test, and the secrets scan. The
browser tests use an iPhone-sized Chromium viewport and a local Expo export;
they do not validate haptics, native notifications, camera, or process death.

Run locally from the repository root:

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium
EXPO_PUBLIC_E2E_FIXTURES=1 pnpm --filter @pore/mobile exec expo export --platform web --output-dir .expo-live-preview --clear
pnpm test:e2e
```

On PowerShell, set `$env:EXPO_PUBLIC_E2E_FIXTURES='1'` before the export.
`pnpm test:e2e` starts a static preview at `http://127.0.0.1:8104/` when one
is not already running. Internal fixtures are at `/internal/e2e-fixtures` and
replace local app data only after a deliberate selection. Relaunch or reload
after selection. They contain fictional data only.

For the negative gate, export with the flag unset and `--clear`, then run
`E2E_EXPECT_DISABLED=1 pnpm test:e2e`. The beta, preview, and production EAS
profiles explicitly set the flag to `0`; only the internal `e2e` profile sets
it to `1`.

## Native internal run

1. Run `eas workflow:run .eas/workflows/session-5-native.yml` from
   `apps/mobile` after the Expo project and credentials are configured. It
   builds an internal Android APK and iOS physical-device artifact and runs
   Maestro on an Android emulator. Alternatively, build the `e2e` profile
   manually and run `maestro test apps/mobile/maestro/` against an installed APK.
2. Keep the Maestro report,
   failed-flow screenshots/video, artifact build IDs, and commit SHA.
3. Repeat the resume, recovery, and notification flows on a physical iPhone.
   Deep-link automation checks routing, while notification delivery/permission
   must be checked with an actual scheduled local notification.
4. Create a **separate beta build** with `--profile beta` after all checks pass.
   Never distribute the `e2e` artifact as beta. Check that opening
   `pore://internal/e2e-fixtures` redirects and cannot replace local data.

## Physical-device checklist (record pass/fail and device/OS)

- [ ] iPhone: fresh adult onboarding, answers-only routine generation, and
      product mapping; no camera is required for this journey.
- [ ] iPhone: AM and PM scheduled steps, full completion, partial skip, and
      no streak award for partial completion.
- [ ] iPhone: kill the process mid-session, relaunch, resume at the unresolved
      step, and confirm saved outcomes survived.
- [ ] iPhone: mild irritation suggests Recovery Mode; strong actives remain
      absent for three local dates; Undo restores the base routine.
- [ ] iPhone: two of three scheduled `not_now` skips suggest Minimum Mode;
      dismissing it hides it for that local date.
- [ ] iPhone: repeated `ran_out` presents product-maintenance guidance and
      does not present adherence or irritation coaching.
- [ ] iPhone: reminder permission, actual local notification delivery and tap
      into the correct routine; test denied permission too.
- [ ] iPhone: VoiceOver focus order, labels, Dynamic Type, Reduce Motion,
      haptics, and light/dark appearance.
- [ ] iPhone: existing scan quality, youth consent, age gate, privacy/delete,
      and serious-reaction safety paths.
- [ ] Android: internal APK installs; Maestro smoke suite passes; notification
      deep link and TalkBack labels work.
- [ ] Beta artifact: fixture URL redirects with no local data mutation.

Attach the completed checklist, device/OS matrix, build URLs, Maestro report,
Playwright report, and any known exceptions to the beta release record. A
failed or unrun item is not a pass.

## Known Session 3/4 audit note

Claude's merged Session 3/4 work provides Apply/Undo and daily-loop hardening.
This session adds the missing two-of-three `not_now`, repeated `ran_out`, and
low-completion coaching branches. Session 4 native device checks remain open
until executed on hardware.
