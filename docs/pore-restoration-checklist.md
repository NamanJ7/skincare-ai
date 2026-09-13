# Pore restoration checklist

## Audit findings and root causes

- **Brand/theme:** the official `apps/mobile/assets/images/pore-logo.png`, Fraunces/Inter typography, spacing, radius, motion, and touch-target tokens are present and in use. The colour layer is a single light-only object, `app.json` forces light appearance, and several semantic roles (elevated surface, navigation, input, success/warning/error) are implicit. This makes a complete persistent dark theme impossible without a theme provider.
- **Navigation:** the current shell exposes Today, Routine, Scan, and Progress. Settings/Profile is a modal opened from Home, Shelf is a hidden compatibility redirect, and tab order does not match the approved five-destination structure.
- **Onboarding:** the assessment, youth consent, safety, scan consent, plan generation, and routine preview are intact and persisted. `onboarding/intro`, `onboarding/consent`, and `onboarding/notifications` are compatibility redirects, so the visual product/scan/progress/privacy demonstrations and a replay path are missing.
- **Capture quality:** the shared final/session gates already fail closed and cover integrity, face count, framing, face size, yaw/pitch/roll, lighting, backlight, glare, sharpness, occlusion, motion, duplicates, and freshness. The native submission builder currently validates the original capture URI while submitting a resized JPEG, detailed quality metadata is not persisted with scan history, and scan-to-scan comparison does not gate language on capture-condition similarity.
- **Interactions:** route actions are generally wired and destructive scan/data deletion already asks for confirmation. The visible landing Sign in action points to an intentionally unavailable account backend, several external-link failures are silent, Profile has no tour replay/theme control, and some async actions lack duplicate-submit/error state handling.
- **Accessibility/mobile:** shared controls use a 44-point minimum and reduced-motion support exists. The custom tab bar needs explicit safe-area sizing for five items, theme/status-bar state must be synchronized, and icon-only/async/external actions need a final screen-reader and failure-state pass.

## Implementation checklist

### Shared brand and themes

- [ ] Encode the approved Warm Ivory `#F7F4EE`, Charcoal `#1F1F1F`, Sage `#A8B59A`, Soft Lavender `#DCCFF0`, and Mist Gray `#E6E7EB` as named brand tokens.
- [ ] Add complete semantic light/dark palettes with contrast tests and preserve fixed camera-overlay tokens.
- [ ] Add persisted `system | light | dark` preference, hydrate it before first render, and synchronize status/system bars.
- [ ] Migrate shared primitives, patterns, major screens, charts, sheets, fields, and navigation to resolved semantic colours.

### Navigation and Profile

- [ ] Reorder tabs to Home, Progress, Scan, Routine, Profile.
- [ ] Keep Scan centered, elevated, branded, labeled, and safe-area aware.
- [ ] Move the completed Settings/Profile content into the bottom-right tab; keep `/settings` only as a compatibility redirect.
- [ ] Remove the duplicate Home profile shortcut and verify all five destinations.
- [ ] Add theme choice, tour replay, photo/privacy controls, help, legal, diagnostics, and destructive data deletion to Profile.

### Onboarding and education

- [ ] Restore a concise interactive tour for what Pore does, scan quality, routines, progress/time expectations, safety, and privacy.
- [ ] Support forward/back, accurate progress, first-run completion, replay mode, and safe exits.
- [ ] Keep questionnaire, age policy, consent, answer-only path, plan generation, and persisted completion intact.
- [ ] Ensure demonstrations are explicitly illustrative and never resemble the user's analysis.
- [ ] Remove the visible unavailable Sign in control until account sync exists.

### Scan and comparison trust

- [ ] Validate the exact resized JPEG bytes submitted for analysis, not a different source file.
- [ ] Preserve strict all-blockers-must-pass behavior and one prioritized correction at a time.
- [ ] Persist per-pose config version, dimensions, yaw, confidence, and comparison-relevant lighting/framing/sharpness metrics.
- [ ] Gate scan comparison wording when capture conditions/config versions are not comparable.
- [ ] Add regression tests for left/right physical direction, exact-byte binding, poor lighting/blur/framing/pose rejection, metadata persistence, and comparison gating.
- [ ] Verify permission denial/retry, foreground recovery, retake, camera-ready, capture-error, and duplicate-submit states.

### Interaction and state audit

- [ ] Verify every route/button against a real outcome; remove or hide controls that cannot act.
- [ ] Add visible loading/error/success/empty states and duplicate-submit protection to async actions.
- [ ] Catch external-link/settings failures and provide an actionable message.
- [ ] Preserve honest answer-only analysis failures; never synthesize a scan result.
- [ ] Keep destructive actions confirmed and ensure photo/history/state cleanup remains complete.

### Verification

- [ ] Run copy audit, lint, mobile/shared/web tests, type-check, Expo doctor, and production exports.
- [ ] Rebuild `apps/mobile/.expo-live-preview` and inspect Home, Progress, Scan, Routine, Profile, onboarding, results, and settings in light/dark at narrow and large text sizes.
- [ ] Document real-device-only iOS/Android camera, permission, background recovery, yaw-sign, thermal/frame-rate, WebView/Safari, status-bar, and gesture-navigation checks.

