# Native scan QA and calibration protocol

Run this protocol on an iPhone EAS development build, never the simulator.
Record device model, iOS version, app build, and quality-config version.

## Preflight

1. Confirm the right-cheek instruction accepts a right-cheek turn. If not, make
   the isolated `YAW_SIGN` follow-up change with a regression test.
2. Confirm the debug overlay has no evidence error, packet age is normally under
   400 ms, and luma/sharpness metrics update during movement and lighting changes.
3. Capture each pose and confirm a 16-hex armed hash is logged. Every
   `final_capture` row must report `orientationAgreement: "metadata"` (or a
   genuine symmetric `tie`), and `previewFinalDistance` must be `<= 0.34`, with
   typical device values near `<= 0.2`. A consistently lower
   `alternatePreviewFinalDistance` is a release blocker: investigate camera
   metadata handling rather than adding a device-global mirror constant.

## Calibration sweep

For 30, 45, and 60 cm, capture front/right/left in soft daylight, dim indoor
light, strong backlight, direct lamp light, and uneven side light. Use **Export
QA log** on the camera overlay or **Settings → Scan QA (development) → Export
calibration log** after final validation. The export begins with app, build,
device, and OS context. Note false blocks and false passes by device, lighting,
and visible skin tone; adjust one policy band at a time, bump
`QUALITY_CONFIG.version`, and add a fixture before committing.

Run the full sweep on at least three physical iPhones: the oldest supported
generation, a mid-range/notched device, and a current generation. Include at
least two supported iOS major versions where the device pool allows it. Clear
the calibration log before each device/lighting sweep and keep each export with
the QA record.

The consented photos and participant identifiers belong in access-controlled QA
storage, never this repository or product analytics. The repository may contain
only de-identified labels, aggregate metric distributions, and the signed release
report. Production telemetry must not include image bytes, landmarks, face hashes,
cosmetic findings, or questionnaire answers.

Label supported-condition attempts and hard negatives separately. Coverage must
include varied visible skin tones, age bands in product scope, glasses/hair/makeup,
dirty lenses, motion, distance, pose, front-camera processing, and lighting color
temperatures. Report false accepts, false rejects, attempts-to-complete, latency,
and frame rate by device and consented tone band; include sample sizes and confidence
intervals rather than presenting a small sweep as population accuracy.

## Repeatability and acceptance

Take five scans of one consented person in the same lighting and position.
Compare final overall scores, blocking issues, preview/final distances, and
analysis priorities. Document variance before changing thresholds.

Verify: dim room shows `too_dark`; direct lamp shows `too_bright`; motion or a
smeared lens shows `blurry`; recovery does not flap; the manual pre-arm shutter
is visibly disabled and unlocks only on a passing frame; pressing as an armed
frame expires does not capture; single-angle retakes retain sibling hashes;
forced-blocked captures remain answer-based; review followed by “Use these
photos” reaches real scan analysis without `preview_mismatch`.

## Release gates

- No hard-negative fixture may be accepted for analysis: no face, multiple
  faces, covered lens, severe blur/backlight, corrupt/stale content, or wrong pose.
- At least 95% of supported-condition attempts must complete within two retakes
  per pose in the release corpus.
- No measured completion-rate gap between a device or consented tone subgroup
  and the overall corpus may exceed five percentage points; a wider confidence
  interval is an evidence gap and blocks an accuracy claim.
- Guidance latency must be at most 250 ms p95, preview at least 24 fps, and
  per-shot final validation at most 3 seconds p95 on every supported device tier.
- Five repeated scans in one controlled setup must retain the same pass/fail
  outcome and pose classification.
- Every threshold or measurement-algorithm change requires a quality-config
  version bump, a regression fixture, and an attached de-identified release report.

If dual MLKit outputs cause material thermal or frame-rate contention, move the
guidance detector onto the packet face seam while preserving the evidence,
armed-frame, and capture metadata contracts.
