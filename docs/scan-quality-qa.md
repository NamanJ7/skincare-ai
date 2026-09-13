# Pore scan quality manual QA and calibration

Run this checklist on physical hardware. Simulators, virtual cameras, and
desktop prerecorded streams are useful for regression checks but do not expose
real autofocus, rolling-shutter, sensor noise, or camera pipeline behavior.

For every rejection verify all four outcomes:

1. Capture is disabled before the live gate has a complete stable pass streak.
2. Only the highest-priority corrective instruction is visible.
3. A failed final capture is not stored as accepted and opens a retake state.
4. No upload, model request, result screen, prior result, mock result, or scan
   timestamp is produced from the rejected attempt.

## Blocking matrix

| Case | How to reproduce | Expected primary guidance |
| --- | --- | --- |
| Blurred face | Defocus the camera or place translucent film over the face area while leaving the background sharp | Clean your camera lens and try again / Hold still for a sharper photo |
| Motion blur | Move the phone or head during the live pass streak and during shutter capture | Hold still |
| Dark face | Stand in a dim room without a direct facial light | Face a window or move toward a brighter light |
| Overexposed face | Aim a bright lamp directly at the face | Move away from direct light |
| Backlighting | Put a bright window behind the face | Reduce the light behind you |
| Uneven light | Light only one side of the face | Move toward more even lighting |
| Face too far | Move back until facial skin pixels are insufficient | Move closer |
| Face too close | Fill the frame and crop forehead/chin | Move farther away |
| Face outside frame | Shift laterally or vertically beyond the guide | Center your face |
| Wrong pose | Use a front pose for a cheek step or turn the opposite direction | Turn slightly left/right |
| Excess yaw | Turn to a full side profile | Turn back toward the camera slightly |
| Head pitch | Look materially up or down | Keep the camera level with your face |
| Head roll | Tilt one ear toward a shoulder | Keep your head level |
| Multiple faces | Add a second person or a high-quality face poster | Only one person should be visible |
| No face | Point at a room or object | Position your face in the guide |
| Hair occlusion | Cover a cheek/jaw with hair | Move your hair away from your cheek |
| Hand occlusion | Cover cheek, forehead, or chin with a hand | Move your hand away from your face |
| Mask/glasses glare | Cover lower face or create opaque glare over the eye/cheek region | Remove anything blocking your skin |
| Covered lens | Cover most or all of the camera | Uncover your camera lens |
| Blank/uniform frame | Feed a white, black, or nearly uniform frame | Uncover your camera lens |
| Low resolution | Upload below the configured image and facial-pixel minimums | Use a higher-resolution photo |
| Sharp background, blurry face | Keep a detailed background focused while face is out of focus | Hold still for a sharper photo |
| Duplicate poses | Reuse the same file or capture nearly the same yaw for two steps | Retake the indicated angle |
| Left/right insufficient separation | Capture two mildly turned views with the same yaw sign | Turn to show the requested cheek |
| Stale capture | Delay an async capture, retake, then resolve the older operation | Retake this photo |
| Previous-session image | Resume/inject a capture carrying another session ID | Start a new scan |
| Corrupt image | Upload truncated or invalid image bytes | Choose a different photo |
| Final-only blur | Pass live validation, then move exactly as capture fires | Photo was blurry—retake |

## Desktop calibration

- Test Chrome, Safari, Firefox, and Edge where supported; include integrated
  laptop webcams and at least one external 720p/1080p webcam.
- Test camera permission denied, detector/model load failure, a throttled CPU,
  background-tab resume, camera switching, portrait/landscape streams, and
  `requestVideoFrameCallback` fallback.
- Confirm the displayed mirrored preview and the unmirrored stored pixels map
  left/right cheek labels correctly.
- Compare live-preview and final-capture perceptual hashes during a still pose,
  normal micro-movement, rapid motion, and a camera switch. Calibrate the match
  ceiling from genuine pairs; never raise it enough to admit a different pose.
- Collect facial-skin sharpness distributions for in-focus and deliberately
  defocused faces at each common stream resolution. Background detail must not
  improve the facial sharpness metric.

## Android calibration

- Use physical low-, mid-, and high-tier devices, including a noisy front
  camera, fixed-focus camera, and aggressive beauty-filter camera if available.
- Verify preview coordinate transforms, front-camera mirroring, sensor rotation,
  camera cutouts, aspect-fill cropping, and ML Kit yaw sign on every model.
- Test autofocus settling after each pose change, low-light denoising, HDR,
  shutter latency, rolling-shutter motion, app background/resume, thermal
  throttling, and camera interruption by another app.
- Record the live detector cadence and ensure the pass streak counts genuinely
  new frame IDs rather than repeated detections.
- Calibrate sharpness by resolution bucket. Do not reduce a global threshold to
  accommodate one poor device; add a documented device/resolution calibration
  only when it still separates usable and unusable facial texture.

## iOS calibration

- Use physical devices across at least three camera generations and test both
  standard and low-light conditions. ML Kit/native modules may not behave like
  hardware on the simulator.
- Verify orientation under portrait lock, responsive orientation, front-camera
  mirroring, aspect-fill crop, autofocus/exposure settling, HDR/Deep Fusion
  latency, and app interruption/background resume.
- Confirm the final still is the newly captured frame, not the last paused
  preview frame, and that capture cannot run before camera-ready.
- Test sensor smoothing/beauty effects for loss of true skin texture. A visually
  clean but texture-erased frame must not receive a sharpness pass.

## Threshold calibration protocol

1. Build a consented, diverse calibration set spanning skin tones, ages in
   product scope, lighting color temperatures, cameras, and pose/occlusion
   conditions. Store labels, not identities, wherever possible.
2. Label each metric independently and blind reviewers to current thresholds.
3. Optimize for a very low false-pass rate on unusable images. A higher retake
   rate is acceptable; false confidence is not.
4. Inspect error rates by skin tone and lighting. Prefer clipping, local
   contrast, bilateral uniformity, and texture measures over a narrow mean-luma
   band.
5. Calibrate live and final gates separately. Final full-resolution validation
   must be at least as strict as live validation.
6. Version every threshold change, record the dataset and device matrix used,
   and add a regression fixture before changing a value.
7. Never tune using only the happy path or by lowering thresholds until a demo
   passes. Document an evidence-based reason for every adjustment.
