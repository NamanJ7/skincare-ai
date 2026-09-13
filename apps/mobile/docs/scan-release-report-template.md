# Guided scan release report

Use one copy of this report for every quality-config or measurement-algorithm
change. Attach aggregate exports only. Never attach participant names, image
bytes, landmarks, face hashes, cosmetic findings, or questionnaire answers.

## Build and policy

- App/build:
- Commit:
- Quality-config version:
- iOS versions:
- Device tiers/models:
- Test dates and reviewers:
- Protected fixture-set version and consent record owner:

## Corpus coverage

| Cohort | Attempts | Supported conditions | Hard negatives |
| --- | ---: | ---: | ---: |
| Overall |  |  |  |
| Oldest supported device tier |  |  |  |
| Mid-range device tier |  |  |  |
| Current device tier |  |  |  |
| Consented visible-tone bands |  |  |  |

Document coverage for soft/dim/direct/back/uneven light, distance, three poses,
motion, hair/glasses/makeup, dirty/covered lens, and front-camera processing.

## Accuracy and completion

- Hard-negative false accepts (required: 0):
- Supported-condition completion within two retakes/pose (required: >=95%):
- Largest device/tone completion gap (required: <=5 percentage points):
- Repeated controlled-scan pass/pose agreement (required: 5/5):
- False rejects by primary corrective code:
- Confidence intervals and material evidence gaps:

## Performance

| Metric | Oldest tier p95 | Mid tier p95 | Current tier p95 | Gate |
| --- | ---: | ---: | ---: | ---: |
| Guidance latency |  |  |  | <=250 ms |
| Preview frame rate |  |  |  | >=24 fps |
| Per-shot final validation |  |  |  | <=3 s |

## Integrity checks

- [ ] Preview/final mirror and orientation agree on every release device.
- [ ] Manual and automatic capture require the same fresh attestation.
- [ ] Immediate final failure cannot enter an analysis-ready session.
- [ ] Retaking one pose preserves and re-hashes the other verified artifacts.
- [ ] Browser copy says timeline-only until browser final validation exists.
- [ ] No production telemetry contains prohibited photo or health-adjacent data.

## Decision

- Release approved / blocked:
- Blocking evidence or accepted residual limitations:
- Reviewer and date:
