# Pore scan quality architecture

## Non-negotiable invariant

Skin analysis accepts only an `AnalysisReadySession` produced by the shared
analysis guard. UI state, a green overlay, a legacy verdict, image count alone,
or a previously saved result cannot create that type. Any missing, invalid,
stale, unchecked, or non-finite evidence fails closed.

## Pipeline

```text
camera preview frame
  -> platform evidence extraction (pixels + face landmarks + frame identity)
  -> independent live quality checks
  -> one prioritized corrective action
  -> consecutive unique-frame pass tracker
  -> enabled shutter / auto-capture
  -> immutable final full-resolution frame
  -> independent final evidence extraction and quality checks
  -> optional analysis encoding, decoded and checked again
  -> accepted capture with session/capture/frame IDs and content hashes
  -> three-pose session validation
  -> analysis guard
  -> model request
```

The preview result is never copied onto the final file. The final validator
re-detects the face and re-measures the pixels from the actual immutable image.

## Module ownership

- `capture`: camera lifecycle, immutable frame acquisition, and encoding only.
- `quality`: structured contract, composition, scoring, and fail-closed policy.
- `quality/checks`: independent integrity, face, framing, sharpness, lighting,
  pose, motion, occlusion, and resolution checks.
- `guidance`: issue priority and one corrective message at a time.
- `poses`: front/left/right targets and pose tolerances.
- `review`: presentation of accepted quality facts or a mandatory retake.
- `session`: current-session identity, three separate pose captures, content
  hashes, duplicate detection, expiry, and final session validation.
- `analysis`: the only transition from a validated session to a model request.
- `tests`: pure metric/session regression tests plus platform integration tests.

Shared policy is DOM- and React-Native-free. Browser and native adapters only
extract evidence; they cannot lower thresholds or manufacture a pass.

## Quality result contract

Each evaluation returns a serializable object containing:

- `passed`: true only when every required blocking check passed.
- `overallScore`: a 0–1 summary for diagnostics, never a substitute for
  `passed` and never shown to normal users.
- `confidence`: confidence that the required evidence was measured correctly.
- `metrics`: named per-check results with pass state, score, confidence, and
  measured values.
- `blockingIssues`: all failed hard requirements.
- `warnings`: non-blocking observations that do not conceal a failure.
- `correctiveAction`: the single highest-priority user action.
- `provenance`: gate, step, session, capture, frame, timestamp, dimensions, and
  content identity needed to prevent stale/reused data.

The system never averages away a blocking issue. A high overall score with one
failed blocker still has `passed: false`.

## Live gate

Every evaluated frame must contain fresh, finite face, pixel, motion, and
identity evidence. The tracker counts only unique, monotonically newer frame
IDs. A frame failure, stale frame, detector error, skipped sample, or motion
event resets the pass streak. The shutter remains disabled until the configured
number of consecutive frames has passed and the minimum stable duration has
elapsed. Motion during countdown cancels capture.

The live gate judges *readiness to shoot*, so it does not judge the guidance
stream's own dimensions. Native guidance runs on a low-resolution analysis
stream feeding a much larger photo output; applying the analysis-image floors to
that stream makes every frame fail and the shutter unreachable. Platforms whose
preview is not the future capture therefore declare the still they are
configured to produce (`ImageEvidence.stillWidth/stillHeight`) and the floors
apply to that, while the frame's own pixels are held only to the face-box
minimum the live measurements need. Where the previewed frame *is* the capture
(the browser encodes the crop it measured) no declaration is made and the frame
dimensions are used directly. A declaration can never launder an undersized
capture: the final gate re-applies the same floors to the real decoded bytes.

## Final gate

Final validation runs on the newly captured full-resolution image, not the
preview canvas and not a prior verdict. The final image must:

- decode successfully and meet image/face pixel minimums;
- contain exactly one complete, correctly framed face;
- match the requested yaw, pitch, and roll;
- retain facial-skin sharpness and texture;
- pass face-region exposure, clipping, lighting-uniformity, glare, and
  backlighting checks;
- pass occlusion checks;
- be recent, belong to the current session/capture attempt, and match the
  preview capture window;
- have a content digest and perceptual hash that are bound to the accepted
  capture.

Facial sharpness is measured on a near-native crop of the face, not on a small
render of the whole photo: a downscale is itself a low-pass filter, so measuring
there would hide exactly the focus and motion blur that ruins a read at the size
the model receives. The gradient stencil scales with face width against a fixed
reference, so the metric means the same thing at every capture distance and on
both gates. The perceptual hash is the deliberate opposite — it stays on a small
normalized render, because scale-invariance is what lets it bind a capture to
the live frame that armed it.

Head-pose angles are expressed in the camera-output presentation. Raw analysis
buffers may be mirrored relative to that, and mirroring inverts apparent yaw, so
each path corrects for the mirror state of the pixels it measured rather than
sharing a device-global sign. When the two disagree the failure is invisible:
live guidance turns green on a cheek the final pose gate then rejects.

Any failure discards the pending acceptance and displays a retake correction.
There is no “Use anyway” action.

## Three-photo session gate

The session guard requires exactly one accepted capture for each configured
pose. It verifies:

- front, left, and right keys and pose labels are all present;
- every capture contains a passed final result;
- session IDs match the active session and capture/frame IDs are unique;
- captures are fresh and content digests are present;
- exact and perceptual duplicates are absent;
- front yaw is neutral, side yaw signs match their requested cheeks, and
  left/right yaw separation is meaningful;
- the exact submitted payload digest corresponds to the quality-passed file.

Draft resume preserves its original session identity only within the configured
expiry and revalidates files before submission. A completed or expired draft
cannot seed a new session.

## Guidance priority

Only the first applicable correction is displayed. Priority is based on what
the user must fix first:

1. Invalid, blank, covered, corrupt, stale, or wrong-session frame.
2. No face or more than one face.
3. Face incomplete/outside the guide.
4. Face too far or too close / insufficient facial pixels.
5. Wrong yaw direction or amount, then excessive pitch or roll.
6. Skin occlusion.
7. Backlighting, severe under/overexposure, clipping/glare, then uneven light.
8. Facial-skin blur or probable dirty lens.
9. Motion or incomplete consecutive stability streak.
10. Duplicate or insufficiently different pose at session review.

The displayed copy is corrective (for example, “Reduce the light behind you”)
rather than a raw metric label.

## Analysis boundary

The client guard validates the session immediately before serialization. The
API repeats the session and image-binding checks, requires exactly three bound
images, disables caching, and rejects invalid input before any model call. A
missing model credential or downstream failure returns an explicit unavailable
error. It never invokes a mock assessment and never returns the prior result.
