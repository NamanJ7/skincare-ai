# Self-hosted MediaPipe assets (skin-scan flow)

Self-hosted so the scan page ("your photos are analyzed once and never
stored") makes no third-party requests mid-scan, and so the wasm runtime can
never drift from the installed JS API.

- `wasm/` — copied verbatim from `node_modules/@mediapipe/tasks-vision/wasm`
  at version **0.10.35** (pinned exactly in `apps/web/package.json`). Re-copy
  whenever that package version changes.
- `face_landmarker.task` — FaceLandmarker float16 v1 model (Apache-2.0) from
  `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`

Loaded by `apps/web/lib/scan/face-landmarker.ts`.
