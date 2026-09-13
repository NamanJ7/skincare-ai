# Native scan guidance (dev/EAS build)

Native capture uses two camera outputs: the existing MLKit detector drives
centering, distance, pose, and the countdown; a VGA Y-plane evidence output
samples face pixels for the armed perceptual hash and live lighting/blur gate.

```text
ScanCamera → MLKit Face[] → useNativeGuidance → shared detector ladder
           → VGA YUV packet → native-quality-adapter → pixel override
           → armed frame → CaptureMeta → final image quality/session binding
```

`useNativeGuidance` requires a fresh pixel-bearing packet before auto-capture
can arm. The manual shutter uses that same armed-frame requirement: it stays
visibly disabled until a fresh frame passes live quality, and the camera checks
again at press time so an expired frame cannot race into an unbound capture.
The second MLKit output is an intentional QA watchpoint: if it causes
contention, feed guidance from the packet face seam without changing the
capture metadata contract.

## Build and calibrate

Use a real-device development client; MLKit face detection does not run in the
iOS simulator.

```bash
cd apps/mobile
eas build --profile development --platform ios
npx expo start --dev-client
```

Before release, confirm yaw direction (`YAW_SIGN`), metadata-driven hash
orientation, and face-width bands. The live hash is normalized with the camera
frame's `isMirrored` metadata; there is no device-global mirror constant.
Development builds display packet age, pixel metrics, override state, evidence
errors, and the armed hash. Use **Export QA log** on the overlay, or
**Settings → Scan QA (development)** after final validation, to share the JSONL
metric/hash ring buffer. Production UI and logs omit these diagnostics. Follow
`scan-qa-protocol.md` for the complete device sweep.
