"use client";

import Link from "next/link";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";

import {
  QUALITY_CONFIG,
  STEP_CONFIGS,
  STEP_ORDER,
  assertAnalysisReady,
  validateScanSession,
  type QualityResult,
  type ScanSession,
  type StepId,
} from "@pore/shared/scan";

import { CameraCapture } from "./CameraCapture";
import { PhotoReview } from "./PhotoReview";
import { ResumeBanner } from "./ResumeBanner";
import { ScanReview } from "./ScanReview";
import { ScanConsentGate } from "./ScanConsentGate";
import { SkinScanIntro } from "./SkinScanIntro";
import { UploadFallback } from "./UploadFallback";
import { blobToBase64 } from "@/lib/scan/capture";
import { disposeFaceLandmarker } from "@/lib/scan/face-landmarker";
import { newScanSessionId, sha256Blob } from "@/lib/scan/provenance";
import { clearDraft, loadDraft, saveDraft, type ScanDraft } from "@/lib/scan/scan-store";
import type { CapturedShot } from "@/lib/scan/types";

type Phase = "intro" | "capture" | "final-review" | "saved";

interface FlowState {
  phase: Phase;
  sessionId: string;
  startedAt: number;
  stepIndex: number;
  mode: "camera" | "upload";
  shots: Partial<Record<StepId, CapturedShot>>;
  pendingShot: CapturedShot | null;
  returnToReview: boolean;
}

type FlowAction =
  | { type: "START"; mode: "camera" | "upload"; sessionId: string; startedAt: number }
  | { type: "SET_MODE"; mode: "camera" | "upload" }
  | { type: "SHOT_TAKEN"; shot: CapturedShot }
  | { type: "RETAKE_PENDING" }
  | { type: "ACCEPT_PENDING" }
  | { type: "RETAKE_STEP"; stepId: StepId }
  | { type: "EXIT_CAPTURE" }
  | { type: "RESUME"; sessionId: string; startedAt: number; shots: Partial<Record<StepId, CapturedShot>> }
  | { type: "SAVED" };

const initialState: FlowState = {
  phase: "intro",
  sessionId: "",
  startedAt: 0,
  stepIndex: 0,
  mode: "camera",
  shots: {},
  pendingShot: null,
  returnToReview: false,
};

function firstMissingStep(shots: FlowState["shots"]): number {
  const index = STEP_ORDER.findIndex((stepId) => !shots[stepId]);
  return index === -1 ? 0 : index;
}

function reducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case "START":
      return { ...state, phase: "capture", mode: action.mode, sessionId: action.sessionId, startedAt: action.startedAt, stepIndex: firstMissingStep(state.shots), pendingShot: null, returnToReview: false };
    case "SET_MODE": return { ...state, mode: action.mode, pendingShot: null };
    case "SHOT_TAKEN":
      if (action.shot.acceptance.sessionId !== state.sessionId || !action.shot.acceptance.quality.passed) return state;
      return { ...state, pendingShot: action.shot };
    case "RETAKE_PENDING": return { ...state, pendingShot: null };
    case "ACCEPT_PENDING": {
      const pending = state.pendingShot;
      if (!pending || !pending.liveQuality.passed || !pending.originalQuality.passed || !pending.acceptance.quality.passed || pending.acceptance.sessionId !== state.sessionId) return state;
      const shots = { ...state.shots, [pending.stepId]: pending };
      if (state.returnToReview || STEP_ORDER.every((stepId) => shots[stepId])) {
        return { ...state, shots, pendingShot: null, returnToReview: false, phase: "final-review" };
      }
      return { ...state, shots, pendingShot: null, stepIndex: firstMissingStep(shots) };
    }
    case "RETAKE_STEP": return { ...state, phase: "capture", stepIndex: STEP_CONFIGS[action.stepId].index, pendingShot: null, returnToReview: true };
    case "EXIT_CAPTURE": return { ...state, phase: "intro", pendingShot: null, returnToReview: false };
    case "RESUME": {
      const complete = STEP_ORDER.every((stepId) => action.shots[stepId]);
      return { ...initialState, sessionId: action.sessionId, startedAt: action.startedAt, shots: action.shots, phase: complete ? "final-review" : "capture", stepIndex: firstMissingStep(action.shots) };
    }
    case "SAVED": return { ...state, phase: "saved" };
  }
}

export function ScanFlow() {
  const [state, dispatch] = useReducer(reducer, initialState);
  // Per-visit, never persisted — the mobile flow re-asks on every visit too,
  // so a consent decision cannot silently outlive the session that made it.
  const [consented, setConsented] = useState(false);
  const [draft, setDraft] = useState<ScanDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; });

  useEffect(() => {
    let cancelled = false;
    void loadDraft().then((loaded) => {
      if (cancelled) return;
      if (loaded && Date.now() - loaded.startedAt <= QUALITY_CONFIG.session.maxSessionAgeMs) setDraft(loaded);
      else if (loaded) void clearDraft();
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => {
    disposeFaceLandmarker();
    const current = stateRef.current;
    for (const shot of Object.values(current.shots)) URL.revokeObjectURL(shot.previewUrl);
    if (current.pendingShot) URL.revokeObjectURL(current.pendingShot.previewUrl);
  }, []);

  const step = STEP_CONFIGS[STEP_ORDER[state.stepIndex]];
  const session = sessionFromState(state);
  const sessionValidation = state.phase === "final-review" ? validateScanSession(session) : null;

  const handleStart = (mode: "camera" | "upload") => {
    const current = stateRef.current;
    dispatch({
      type: "START",
      mode,
      sessionId: current.sessionId || newScanSessionId(),
      startedAt: current.startedAt || Date.now(),
    });
  };

  const handleRetakePending = useCallback(() => {
    const pending = stateRef.current.pendingShot;
    if (pending) URL.revokeObjectURL(pending.previewUrl);
    dispatch({ type: "RETAKE_PENDING" });
  }, []);

  const handleAcceptPending = useCallback(() => {
    const current = stateRef.current;
    const pending = current.pendingShot;
    if (!pending?.acceptance.quality.passed) return;
    const replaced = current.shots[pending.stepId];
    if (replaced) URL.revokeObjectURL(replaced.previewUrl);
    dispatch({ type: "ACCEPT_PENDING" });
  }, []);

  const handleResume = useCallback(async () => {
    const loaded = await loadDraft();
    if (!loaded || Date.now() - loaded.startedAt > QUALITY_CONFIG.session.maxSessionAgeMs) {
      setDraft(null);
      await clearDraft();
      return;
    }
    const shots: Partial<Record<StepId, CapturedShot>> = {};
    try {
      for (const saved of loaded.shots) {
        const digest = await sha256Blob(saved.analysisBlob);
        if (digest !== saved.acceptance.contentDigest || saved.acceptance.sessionId !== loaded.sessionId || !saved.acceptance.quality.passed) throw new Error("Draft binding failed");
        shots[saved.stepId] = {
          ...saved,
          base64: await blobToBase64(saved.analysisBlob),
          previewUrl: URL.createObjectURL(saved.originalBlob),
        };
      }
      if (STEP_ORDER.every((stepId) => shots[stepId])) {
        const validation = validateScanSession({ sessionId: loaded.sessionId, startedAt: loaded.startedAt, captures: capturesFromShots(shots) });
        if (!validation.passed) throw new Error("Draft session validation failed");
      }
      setDraft(null);
      dispatch({ type: "RESUME", sessionId: loaded.sessionId, startedAt: loaded.startedAt, shots });
    } catch {
      for (const shot of Object.values(shots)) URL.revokeObjectURL(shot.previewUrl);
      setDraft(null);
      await clearDraft();
    }
  }, []);

  const handleSaveLater = useCallback(async () => {
    const current = stateRef.current;
    setBusy(true);
    setSubmissionError(null);
    try {
      // The browser can persist a quality-validated session, but it cannot
      // honestly claim analysis until an intake-backed API is connected.
      assertAnalysisReady(sessionFromState(current));
      const shots = STEP_ORDER.flatMap((stepId) => {
        const shot = current.shots[stepId];
        return shot ? [{
          stepId: shot.stepId,
          source: shot.source,
          originalBlob: shot.originalBlob,
          originalMediaType: shot.originalMediaType,
          analysisBlob: shot.analysisBlob,
          mediaType: shot.mediaType,
          analysisWidth: shot.analysisWidth,
          analysisHeight: shot.analysisHeight,
          liveQuality: shot.liveQuality,
          originalQuality: shot.originalQuality,
          acceptance: shot.acceptance,
          previewPerceptualHash: shot.previewPerceptualHash,
        }] : [];
      });
      if (!(await saveDraft(current.sessionId, current.startedAt, shots))) {
        throw new Error("We could not save this scan on this device. Check browser storage permissions and try again.");
      }
      dispatch({ type: "SAVED" });
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "This scan is not ready to save. Retake the flagged photo.");
    } finally {
      setBusy(false);
    }
  }, []);

  // Age + photo consent runs ahead of everything, including the MediaPipe
  // warmup that SkinScanIntro triggers on mount. Nothing touches the camera
  // until this passes.
  if (!consented) {
    return <ScanConsentGate onAccept={() => setConsented(true)} />;
  }

  if (state.phase === "intro") {
    return <SkinScanIntro onStart={handleStart} capturedCount={STEP_ORDER.filter((stepId) => state.shots[stepId]).length} banner={draft ? <ResumeBanner draft={draft} onResume={handleResume} onDiscard={() => { setDraft(null); void clearDraft(); }} /> : null} />;
  }
  if (state.phase === "capture") {
    if (state.mode === "upload") {
      return state.pendingShot
        ? <PhotoReview step={step} shot={state.pendingShot} appearance="light" onAccept={handleAcceptPending} onRetake={handleRetakePending} />
        : <UploadFallback sessionId={state.sessionId} step={step} stepNumber={state.stepIndex + 1} totalSteps={STEP_ORDER.length} onShot={(shot) => dispatch({ type: "SHOT_TAKEN", shot })} onExit={() => dispatch({ type: "EXIT_CAPTURE" })} onUseCamera={() => dispatch({ type: "SET_MODE", mode: "camera" })} />;
    }
    return <CameraCapture key={`${state.sessionId}:${step.id}`} sessionId={state.sessionId} step={step} stepNumber={state.stepIndex + 1} totalSteps={STEP_ORDER.length} pendingShot={state.pendingShot} onShot={(shot) => dispatch({ type: "SHOT_TAKEN", shot })} onAccept={handleAcceptPending} onRetake={handleRetakePending} onExit={() => dispatch({ type: "EXIT_CAPTURE" })} onUploadInstead={() => dispatch({ type: "SET_MODE", mode: "upload" })} />;
  }
  if (state.phase === "final-review") {
    return <ScanReview shots={state.shots} validation={sessionValidation!} error={submissionError} busy={busy} onRetakeStep={(stepId) => dispatch({ type: "RETAKE_STEP", stepId })} onSave={handleSaveLater} />;
  }
  return <ScanOutcome />;
}

function capturesFromShots(shots: FlowState["shots"]): ScanSession["captures"] {
  return STEP_ORDER.reduce<ScanSession["captures"]>((captures, stepId) => {
    const shot = shots[stepId];
    if (shot) captures[stepId] = shot.acceptance;
    return captures;
  }, {});
}

function sessionFromState(state: FlowState): ScanSession {
  return { sessionId: state.sessionId, startedAt: state.startedAt, captures: capturesFromShots(state.shots) };
}

function ScanOutcome() {
  const title = "Validated scan saved on this device";
  const body = "The three photos passed the current quality checks and stay in this browser until this scan session expires or you delete them. No skin analysis was submitted.";
  return (
    <div className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 text-center">
      <h1 className="font-display text-3xl font-semibold">{title}</h1><p className="text-ink-muted">{body}</p>
      <Link href="/" className="mt-2 rounded-pill bg-primary px-7 py-3.5 font-semibold !text-on-primary">Back to home</Link>
    </div>
  );
}

export type { QualityResult };
