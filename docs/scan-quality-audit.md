# Pore scan quality audit

Audit date: 2026-07-10

This audit records the pre-rebuild behavior. It is intentionally separate from
the implementation so the original failure mode remains reviewable.

## End-to-end image trace

1. **Preview frames**
   - Browser: `getUserMedia` is attached to a `<video>`. MediaPipe reads that
     element and a 64-pixel-wide canvas supplies the lighting/blur heuristic.
   - Native iOS/Android: Expo `CameraView` renders the preview, but no preview
     pixels or face detections reach the quality system. The native guidance
     adapter is disabled and device motion supplies only a visual hint.
2. **Captured image**
   - Browser: the current video frame is drawn unmirrored, immediately resized
     to at most 1024 pixels wide, and encoded as JPEG quality 0.7.
   - Native: `takePictureAsync({ quality: 0.9 })` returns a temporary URI. Only
     the URI is retained; capture width, height, frame identity, and quality
     provenance are discarded.
3. **Image sent toward analysis**
   - Browser: the compressed 1024-pixel JPEG/base64 is handed to an analysis
     stub that always reports `queued`.
   - Native: review independently resizes each accepted URI to width 1024 and
     JPEG quality 0.7, then sends bare base64 images to `/api/plan`. The quality
     result and pose label are not included.

## Required audit findings

1. **Where the preview comes from:** browser preview frames come from the live
   DOM video; native preview frames are not acquired for validation.
2. **What is saved:** browser stores a recompressed video-frame blob; native
   stores temporary capture URIs and later copies those files for history.
3. **What is analyzed:** a separately compressed 1024-pixel derivative, not a
   final full-resolution image that passed a second validation gate.
4. **Mocks, fallbacks, cache, and reuse:** when `ANTHROPIC_API_KEY` is absent,
   `/api/plan` returns a deterministic `mockAssessment(intake)` that ignores all
   image content. The browser scan uses a static queued-response stub. A failed
   native rescan leaves the previously persisted plan in state, so an old result
   can appear to belong to the new scan. Processing failures intentionally
   continue with zero images. IndexedDB uses one fixed draft key with no scan
   session identity or expiry.
5. **Default-pass behavior:** missing detector data, missing pixel stats, upload
   validation exceptions, and post-capture validation exceptions can all
   degrade to `acceptable`, `ok`, or no verdict. Non-finite numeric values can
   fall through comparisons. None of those cases fails closed.
6. **Implemented versus simulated checks:** browser face count, approximate
   face box, coarse yaw, low-resolution luma/clipping, gradient energy, and
   centroid drift are real. The overlay is presentational. Native face/framing/
   pose checks are not implemented. Pitch is calculated but not gated; roll,
   facial-skin ROIs, optical motion blur, bilateral lighting, backlighting,
   glare, texture visibility, occlusion, resolution, corruption, covered lens,
   duplicates, and stale-frame checks are absent.
7. **Advisory versus blocking:** validation is explicitly advisory. Manual
   capture bypasses the live verdict, blocked images offer “Use anyway,” and
   final submission checks only that the UI is not busy.
8. **Resize/compression before validation:** browser capture is resized and
   compressed before its only stored verdict; native final checking downsizes
   the photo to 64 pixels, while the later 1024-pixel analysis derivative is
   never revalidated.
9. **Stale asynchronous state:** one native URI-ref comparison prevents a late
   result from replacing a newer preview verdict, but the overall handoff uses
   unversioned module-global arrays. There are no session IDs, capture IDs,
   frame IDs, timestamps, hashes, or preview/final fingerprint matching.
   Browser draft resume trusts stored verdicts without revalidation.
10. **Three-pose independence:** both UIs use three separate slots, but the
    slots contain no enforced pose identity or content identity. The same URI or
    near-identical image can fill every slot; holes can be collapsed and
    relabeled; left/right angular separation is never checked.

## Root cause

The old architecture was deliberately fail-open: quality was treated as a UX
hint, capture and review provided bypasses, the final encoded files carried no
quality provenance, and the analysis boundary accepted bare image arrays. That
combined with an image-independent mock assessment and persisted previous plan
state to produce confident-looking results from unusable, missing, or stale
photos. The blur symptom is therefore only one manifestation of a broader
capture/session/analysis integrity failure.

## Pre-rebuild test gap

The existing tests codified soft behavior (including manual capture from a bad
state and detector absence as acceptable). They did not cover the capture UI,
the API boundary, final full-resolution validation, duplicates, stale sessions,
or device-specific camera behavior.
