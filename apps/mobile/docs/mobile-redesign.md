# Pore mobile redesign

## Audit summary

The application is an Expo 56 / React Native 0.85 app using Expo Router,
Reanimated 4, React Context state, AsyncStorage persistence, `StyleSheet`, and
shared `@pore/shared` design tokens.

The restoration addressed these highest-impact issues:

- The mobile screens had drifted to green/gold and hard-coded light colours
  instead of the approved five-colour Pore palette.
- Navigation omitted Profile, put settings behind a Home avatar, and did not
  use the approved five-destination order.
- Onboarding education routes were redirects, demonstrations were not
  replayable, and completion writes were not observable.
- Native capture mixed advisory and strict quality signals, could approve while
  final checking was pending, and validated a different file from the submitted
  JPEG.
- Previous plans could remain visible after profile answers changed.
- The browser capture displayed a fabricated queued outcome even though it had
  no intake-backed analysis connection.
- Placeholder mascot art and generic framework assets weakened the brand.

The official logo remains `assets/images/pore-logo.png`. It is reused directly
for brand and companion moments; no substitute Pore logo or mascot is created.

## Screen hierarchy

The primary navigation has five destinations in this order:

1. **Home**
   - time-sensitive greeting
   - one current piece of guidance
   - current AM or PM routine with inline completion
   - small journey and seven-day consistency status
   - next check-in
   - warning only when supported by current scan evidence or a reported red flag
2. **Progress**
   - Skin Journey path
   - Routine consistency lane
   - condition-gated visual comparisons
   - Self-reported skin-experience lane
3. **Scan** (raised centre action)
   - explicit can/cannot explanation
   - current scan status
   - guided consent, capture, review, processing, and result flows
4. **Routine**
   - Routine / Products segmented control
   - AM / PM segmented control
   - compact expandable routine rows
   - Minimum Mode
   - irritation reporting
   - product compatibility and user pause/resume
5. **Profile**
   - profile and plan controls
   - System / Light / Dark appearance
   - reminders, help, tour replay, privacy, and local-data deletion

The old Shelf and Settings routes are compatibility redirects. Shelf opens the
Products section of Routine; Settings opens Profile.

## Design tokens

`packages/shared/src/design/tokens.ts` is the source of truth for:

- approved Warm Ivory `#F7F4EE`, Charcoal `#1F1F1F`, Sage `#A8B59A`,
  Soft Lavender `#DCCFF0`, and Mist Gray `#E6E7EB`
- semantic light and dark background, surface, text, border, action, success,
  caution, error, and camera roles
- spacing, typography, radius, shadow, border, icon, and touch-target scales
- camera surface, scrim, active/idle guide, and aligned-guide colours
- fast, base, gentle, celebration, and journey-draw motion durations
- shared cubic-bezier curves

`colors.escalate` intentionally doubles as the destructive action colour; the
system does not introduce another decorative red. `colors.guidePositive` is
reserved for the dark camera surface and is not a text colour on the cream
canvas.

## Component strategy

The redesign adds or consolidates:

- `TodayRoutineCard`
- `ProductsSection`
- `JourneyPath` and `JourneyMilestone`
- an approved-logo companion with explicit non-colour state copy
- `Disclaimer`
- existing `Callout`, `EmptyState`, `StepCircle`, `RoutineStepCard`,
  `ShelfProductRow`, `CompareView`, `PhotoTimeline`, and scan guidance
  components

Logo-companion use is limited to scan guidance, the current journey point,
empty states, processing, milestones, and uncertainty reassurance. Motion is
disabled when reduced motion is requested.

## Accuracy and state rules

- No combined skin score is shown.
- Routine completion, analyzed visual observations, and self-reported
  experience remain separate.
- A saved but unanalyzed scan is labeled as such.
- Comparison reliability is only described strongly when both photos came
  from scans that passed the implemented analysis gates. Check-in photos are
  explicitly labeled as ungated visual-diary inputs.
- Empty, loading, permission, camera recovery, photo checking, unverified,
  blocked, answer-only, and not-enough-information states use visible text.
- The UI never attributes a visible difference to a product.

## Accessibility

- Interactive primitives and new rows use a minimum 44-point target.
- Dynamic Type remains enabled; fixed-height screens become scrollable when
  font scaling increases.
- New animation uses shared motion tokens and respects reduced motion.
- Status is always written in text rather than communicated by colour alone.
- New interactive rows include roles, state, labels, and hints.
- Camera and comparison errors state the exact limitation or correction.

## Protected implementation contracts

The redesign does not change:

- global age-policy redirects
- versioned photo consent and fresh consent on each scan visit
- front → right → left capture order
- live shutter gates, final-image validation, session binding, or fail-closed
  analysis
- `isCurrentScanAnalysis` provenance rules
- safety reapplication in `routineFor`
- local-date routine and check-in math
- entitlement, scan cadence, report, compatibility, or paywall gates
- existing analytics event sites and privacy boundary

## Current engineering limitations

- Check-in photos are optional visual-diary inputs and do not use the guided
  scan quality pipeline.
- Native right/left yaw, permissions, foreground recovery, and detector
  behavior still require physical iOS and Android calibration in an EAS/dev
  build; Expo Go and mobile web use the explicit answer-only path.
- Occlusion is a landmark-coverage heuristic, not semantic segmentation.
- The server validates current metric structure and exact-byte binding but
  trusts on-device measurements; malicious-client resistance requires backend
  computer vision or signed attestation.
- Quality and comparison thresholds require calibration on consented, diverse
  devices, lighting conditions, and skin tones before validated-accuracy claims.
- Analysis and check-in handoffs are in memory and can be lost if the process
  is terminated mid-flow.
- Account sync, remote analytics delivery, and real App Store purchase/restore
  flows are not implemented in this beta.
