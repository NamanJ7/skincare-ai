# Scan analysis (accuracy & fail-closed)

Pore provides a cosmetic assessment of visible skin, never a medical diagnosis.
Scan analysis is fail-closed: when a real, quality-validated three-pose scan
cannot be produced, the app shows a clearly labelled answer-based read.

## End-to-end path

```text
native camera frame ─┬─ MLKit detector → live framing / pose / countdown
                     └─ VGA pixel evidence → armed hash + live lighting/blur
shutter → CaptureMeta → ScanShot → review → buildAnalysisSubmission
  → render analysis JPEG → digest + final native quality gate
  → validateScanSession → POST /api/plan → bound server analysis
```

The final gate checks the exact image bytes sent to analysis. Camera-source
captures must also include the hash of a fresh live frame and be within
`duplicate.maxPreviewFinalPerceptualDistance`; uploads are exempt. The shared
session validator independently repeats that binding check, so an embedded
client-side `quality.passed` result cannot bypass it.

## Capture behavior

- `useNativeGuidance` retains a fresh frame only while all live gates permit
  capture. Both shutters require that armed frame and reject it after 900 ms;
  an unarmed recent packet is never substituted.
- Pixel evidence blocks auto-capture after two consecutive dark, bright/glary,
  or blurry packets. Manual capture locks with the same live gate and the final
  still is independently judged again.
- Development builds expose a debug overlay and JSONL calibration log containing
  live metrics, mirror metadata, final distances, and hashes only—never image
  bytes. Export it from the overlay or development Settings.

Use a physical EAS development build for QA; MLKit native face detection does
not run in the iOS simulator. See `scan-qa-protocol.md` for the release gate.
