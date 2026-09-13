/**
 * Guided 3-angle capture: front → right cheek → left cheek, each confirmed
 * before the next. Only file URIs travel from here (no base64 — review
 * downscales). `angle` param = re-shooting a single angle from review.
 *
 * The camera surface + live guidance are delegated to <ScanCamera>, which is
 * platform-split:
 *  - Web: expo-camera preview + the MediaPipe loop (ScanCamera.web.tsx).
 *  - Native: vision-camera + the MLKit face detector (ScanCamera.tsx) — real
 *    centering / distance / head-turn guidance + 3-2-1 auto-capture on device.
 *  - Fallback: if a platform reports no detector (guidance.enabled === false),
 *    the screen shows a device-motion "hold still" hint instead.
 * Every shot gets a post-capture lighting/sharpness check. A rejected verdict
 * explains what needs to change and requires a retake before the flow can
 * continue, so every submitted photo has passed the final gate.
 * Native manual and automatic shutters both require a fresh frame that passed
 * live quality, so every accepted shot can be bound to final analysis pixels.
 */
import { useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { ThemeColors } from "@pore/shared";

import {
  QUALITY_CONFIG,
  STEP_CONFIGS,
  STEP_ORDER,
  feedbackMessage,
} from "@pore/shared/scan";

import { CameraPermissionGate } from "@/components/CameraPermissionGate";
import { ScanCamera } from "@/components/scan/ScanCamera";
import { ScanDebugOverlay } from "@/components/scan/ScanDebugOverlay";
import type {
  CaptureMeta,
  ScanCameraError,
  ScanCameraHandle,
} from "@/components/scan/scan-camera-types";
import { ScanGuidanceOverlay } from "@/components/ScanGuidanceOverlay";
import { ScanVerdictBanner } from "@/components/ScanVerdictBanner";
import { track } from "@/lib/analytics";
import { hasCurrentPhotoAnalysisConsent } from "@/lib/consent";
import type { ScanMode } from "@/lib/nav";
import {
  DISABLED_GUIDANCE,
  type GuideState,
  type LiveGuidance,
} from "@/lib/scan/live-guidance-types";
import { photoPrivacyLine } from "@/lib/analysis-status";
import { createScanId } from "@/lib/scan/content-digest";
import { buildValidatedCaptureArtifact } from "@/lib/scan/session-builder";
import { useCameraSessionActive } from "@/lib/scan/use-camera-session-active";
import { useHoldStill } from "@/lib/scan/use-hold-still";
import {
  beginScanCaptureSession,
  clearShots,
  getScanCaptureSession,
  getShots,
  saveShots,
  type ScanCaptureArtifact,
  type ScanShot,
} from "@/lib/scan-session";
import { useOnboarding } from "@/state/onboarding";
import {
  AppText,
  GhostButton,
  PrimaryButton,
  ProgressDots,
  Screen,
  TextButton,
  borderWidth,
  radius,
  spacing,
  touchTarget,
  useThemeColors,
} from "@/theme";

/** A retake target only counts when it names a real step. */
function parseRetakeIndex(raw: string | undefined): number | null {
  if (raw == null) return null;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0 || value >= STEP_ORDER.length)
    return null;
  return value;
}

function guidanceSignature(guidance: LiveGuidance): string {
  return JSON.stringify({
    enabled: guidance.enabled,
    detectorStatus: guidance.detectorStatus,
    code: guidance.code,
    instruction: guidance.instruction ?? null,
    guideState: guidance.guideState,
    countdown: guidance.countdown,
    manualCaptureReady: guidance.manualCaptureReady,
    status: guidance.status ?? null,
    debug: guidance.debug ?? null,
  });
}

export default function Capture() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ mode?: string; angle?: string }>();
  const mode: ScanMode = params.mode === "rescan" ? "rescan" : "onboarding";
  const { data } = useOnboarding();
  const hasPhotoConsent = hasCurrentPhotoAnalysisConsent(
    data.photoAnalysisConsent,
  );
  // `angle` arrives as an untrusted route param. `Number("abc")` is NaN, and
  // NaN != null, so an unvalidated value used to enter single-angle retake mode
  // with `current = NaN`; an out-of-range one wrote a sparse hole into `shots`
  // that review then bounced. Anything unusable falls back to a full scan.
  const retakeIndex = parseRetakeIndex(params.angle);
  const [captureSession] = useState(() =>
    retakeIndex != null
      ? (getScanCaptureSession() ??
        beginScanCaptureSession(createScanId("session")))
      : beginScanCaptureSession(createScanId("session")),
  );

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraGranted, setCameraGranted] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [captureNotice, setCaptureNotice] = useState<string | null>(null);
  const scanRef = useRef<ScanCameraHandle>(null);
  const [shots, setShots] = useState<ScanShot[]>(() =>
    retakeIndex != null ? getShots() : [],
  );
  const [current, setCurrent] = useState(retakeIndex ?? 0);
  const [preview, setPreview] = useState<string | null>(null);
  const [artifact, setArtifact] = useState<ScanCaptureArtifact | null>(null);
  const [qualityCheckComplete, setQualityCheckComplete] = useState(false);
  const [guidance, setGuidance] = useState<LiveGuidance>(DISABLED_GUIDANCE);
  /** Bumped on retake/confirm so live guidance restarts its capture machine. */
  const [attempt, setAttempt] = useState(0);
  const previewUriRef = useRef<string | null>(null);
  const previewMetaRef = useRef<CaptureMeta | undefined>(undefined);
  const cameraRequested =
    hasPhotoConsent &&
    Boolean(permission?.granted || cameraGranted) &&
    preview == null &&
    cameraError == null;
  const cameraHostActive = useCameraSessionActive(true);
  const cameraSessionActive = cameraRequested && cameraHostActive;
  const previousCameraHostActive = useRef(cameraHostActive);

  // ScanCamera publishes a freshly-created guidance object. Keep the callback
  // stable and preserve the previous state when its displayed values have not
  // changed; otherwise the child effect would trigger a parent re-render, which
  // creates another object and loops indefinitely.
  const handleGuidance = useCallback((next: LiveGuidance) => {
    setGuidance((previous) =>
      guidanceSignature(previous) === guidanceSignature(next) ? previous : next,
    );
  }, []);

  const stepId = STEP_ORDER[current] ?? "front";
  const step = STEP_CONFIGS[stepId];

  // A shot (manual or auto) lands here. Before it can advance, create the
  // exact analysis JPEG and run the strict final gate against those same bytes.
  const handleCapture = (uri: string, meta: CaptureMeta) => {
    if (previewUriRef.current) return;
    previewUriRef.current = uri;
    previewMetaRef.current = meta;
    setPreview(uri);
    setArtifact(null);
    setQualityCheckComplete(false);
    const validationStartedAt = Date.now();
    const identity = {
      uri,
      sessionId: captureSession.sessionId,
      stepId,
      ...meta,
    };
    void buildValidatedCaptureArtifact(identity, captureSession)
      .catch(
        (cause): ScanCaptureArtifact => ({
          // Without this the preview would sit on a disabled "Checking photo
          // quality" spinner forever. Fail closed: a photo we couldn't verify
          // is timeline-only, never silently promoted to verified.
          kind: "timeline-only",
          sessionId: identity.sessionId,
          stepId: identity.stepId,
          captureId: identity.captureId,
          capturedAt: identity.capturedAt,
          previewPerceptualHash: identity.previewPerceptualHash,
          previewFrameId: identity.previewFrameId,
          previewHashMirrorApplied: identity.previewHashMirrorApplied,
          reason: {
            code: "processing_failed",
            message:
              cause instanceof Error
                ? cause.message
                : "Pore couldn't verify this photo. Retake it and try again.",
          },
        }),
      )
      .then((nextArtifact) => {
        if (previewUriRef.current !== uri) return;
        const latencyMs = Math.max(0, Date.now() - validationStartedAt);
        setArtifact(nextArtifact);
        setQualityCheckComplete(true);
        track("scan_validation_completed", {
          step_id: stepId,
          outcome: nextArtifact.kind,
          latency_ms: latencyMs,
          attempt_count: attempt + 1,
          quality_config_version: QUALITY_CONFIG.version,
        });
        if (nextArtifact.kind === "verified") {
          track("scan_capture_verified", {
            step_id: stepId,
            attempt_count: attempt + 1,
            quality_config_version: QUALITY_CONFIG.version,
          });
        } else {
          track("scan_capture_rejected", {
            step_id: stepId,
            reason: nextArtifact.reason.code,
            attempt_count: attempt + 1,
            quality_config_version: QUALITY_CONFIG.version,
          });
        }
      });
  };

  // Device-motion steadiness — the honest fallback when no detector is present.
  const holdStill = useHoldStill(
    cameraSessionActive && !guidance.enabled && preview == null,
  );
  const manualCaptureReady =
    cameraSessionActive && cameraReady && guidance.manualCaptureReady;

  useEffect(() => {
    if (manualCaptureReady) setCaptureNotice(null);
  }, [manualCaptureReady]);

  const guidanceTrackedKey = useRef<string | null>(null);
  useEffect(() => {
    if (!manualCaptureReady) return;
    const key = `${stepId}:${attempt}`;
    if (guidanceTrackedKey.current === key) return;
    guidanceTrackedKey.current = key;
    track("scan_guidance_ready", {
      step_id: stepId,
      attempt_count: attempt + 1,
      quality_config_version: QUALITY_CONFIG.version,
    });
  }, [attempt, manualCaptureReady, stepId]);

  useEffect(() => {
    const wasActive = previousCameraHostActive.current;
    previousCameraHostActive.current = cameraHostActive;
    if (wasActive && !cameraHostActive) {
      setCameraReady(false);
      setGuidance(DISABLED_GUIDANCE);
      setCaptureNotice("Camera paused while Pore was not active.");
    } else if (!wasActive && cameraHostActive) {
      setCameraReady(false);
      setCaptureNotice("Restoring camera guidance…");
      setAttempt((value) => value + 1);
    }
  }, [cameraHostActive]);

  const handleCameraError = useCallback((error: ScanCameraError) => {
    if (error.kind === "capture") {
      setCaptureNotice(error.message);
      return;
    }
    setCameraReady(false);
    setCameraError(error.message);
  }, []);

  const leave = () => {
    if (retakeIndex != null) {
      router.back();
      return;
    }
    clearShots();
    if (mode === "onboarding") router.replace("/onboarding/generating");
    else router.back();
  };

  // Permission gates ------------------------------------------------------
  if (!hasPhotoConsent) {
    return <Redirect href={`/scan-flow?mode=${mode}`} />;
  }

  if (!permission) {
    return (
      <Screen scroll={false} contentStyle={styles.permissionLoading}>
        <View
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel="Checking camera permission"
          accessibilityLiveRegion="polite"
          style={styles.permissionLoadingContent}
        >
          <ActivityIndicator size="small" color={colors.actionPrimary} />
          <AppText variant="bodyStrong">Checking camera access…</AppText>
          <AppText
            variant="caption"
            color={colors.textSecondary}
            style={styles.centerText}
          >
            Pore will ask before opening the front camera.
          </AppText>
        </View>
      </Screen>
    );
  }

  if (!permission.granted && !cameraGranted) {
    return (
      <CameraPermissionGate
        body={`The guided scan uses your front camera. ${photoPrivacyLine()}`}
        permission={permission}
        requestPermission={requestPermission}
        onGranted={() => setCameraGranted(true)}
        secondaryLabel={mode === "onboarding" ? "Skip scan for now" : "Go back"}
        onSecondary={leave}
      />
    );
  }

  if (cameraError) {
    return (
      <Screen contentStyle={styles.recoveryScreen}>
        <View style={styles.recoveryCard}>
          <View
            style={styles.recoveryMessage}
            accessible
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
          >
            <AppText variant="titleSans">Camera needs a restart</AppText>
            <AppText color={colors.textSecondary}>{cameraError}</AppText>
          </View>
          <PrimaryButton
            label="Restart camera"
            onPress={() => {
              setCaptureNotice("Restoring camera guidance…");
              setCameraError(null);
            }}
          />
          <GhostButton
            label={mode === "onboarding" ? "Skip scan for now" : "Go back"}
            onPress={leave}
          />
        </View>
      </Screen>
    );
  }

  // Per-shot confirm ------------------------------------------------------
  const confirmShot = () => {
    if (!preview || !artifact) return;
    const next = [...shots];
    next[current] = {
      uri: preview,
      artifact,
    };
    setShots(next);
    previewUriRef.current = null;
    previewMetaRef.current = undefined;
    setPreview(null);
    setArtifact(null);
    setQualityCheckComplete(false);
    setAttempt((a) => a + 1);
    if (retakeIndex != null) {
      // Came from review to redo one angle; hand the fixed set back.
      saveShots(next);
      router.back();
    } else if (current < STEP_ORDER.length - 1) {
      setCurrent(current + 1);
    } else {
      saveShots(next);
      router.push(`/scan-flow/review?mode=${mode}`);
    }
  };

  const retakeShot = () => {
    previewUriRef.current = null;
    previewMetaRef.current = undefined;
    setPreview(null);
    setArtifact(null);
    setQualityCheckComplete(false);
    setAttempt((a) => a + 1);
  };

  const leaveAction = (
    <Pressable
      onPress={leave}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={
        mode === "onboarding" ? "Skip guided scan" : "Cancel scan"
      }
      style={styles.edgeAction}
    >
      <AppText
        variant="bodyStrong"
        color={colors.guideActive}
        style={styles.shadowText}
      >
        {mode === "onboarding" ? "Skip" : "Cancel"}
      </AppText>
    </Pressable>
  );

  if (preview) {
    const checking = !qualityCheckComplete;
    const usableForAnalysis =
      qualityCheckComplete && artifact?.kind === "verified";
    // A platform that cannot verify at all (web) still produced a real photo —
    // it is worth keeping for the timeline. A photo rejected on its own merits
    // is not: that one has to be retaken. Both are `timeline-only`, so the
    // reason code is what separates "can't check here" from "this photo failed".
    const savableToTimeline =
      qualityCheckComplete &&
      artifact?.kind === "timeline-only" &&
      artifact.reason.code === "web_timeline_only";
    return (
      <SafeAreaView style={styles.full} edges={["top", "bottom"]}>
        <Image
          source={{ uri: preview }}
          style={styles.previewImage}
          contentFit="cover"
          accessible
          accessibilityLabel={`${step.label} photo preview`}
        />
        <View style={styles.previewActions}>
          <AppText
            variant="bodyStrong"
            color={colors.guideActive}
            style={{ textAlign: "center" }}
          >
            {step.label}
          </AppText>
          <ScanVerdictBanner
            stepId={stepId}
            artifact={artifact}
            checkComplete={qualityCheckComplete}
          />
          {checking ? (
            <>
              <PrimaryButton
                label="Checking photo quality"
                loading
                disabled
              />
              <TextButton
                label="Retake"
                tone={colors.guideActive}
                onPress={retakeShot}
              />
            </>
          ) : usableForAnalysis || savableToTimeline ? (
            <>
              <PrimaryButton
                label={savableToTimeline ? "Save & continue" : "Continue"}
                onPress={confirmShot}
              />
              <TextButton
                label="Retake"
                tone={colors.guideActive}
                onPress={retakeShot}
              />
            </>
          ) : (
            <PrimaryButton label="Retake photo" onPress={retakeShot} />
          )}
        </View>
        {/* The live-capture screen owns the only other exit, and it is unmounted
            while a preview is up — without this the user can retake forever but
            never leave. */}
        <View style={styles.previewBottomBar}>{leaveAction}</View>
      </SafeAreaView>
    );
  }

  // Live capture ----------------------------------------------------------
  // One instruction at a time: live detector feedback when available,
  // otherwise the motion-based hold-still hint. Never a fake face signal.
  let instruction: string | null = null;
  let positive = false;
  let guideState: GuideState = "adjust";
  if (guidance.enabled) {
    guideState = guidance.guideState;
    if (guidance.detectorStatus === "ready" && guidance.code) {
      instruction = guidance.instruction ?? feedbackMessage(stepId, guidance.code);
      positive = guideState === "good";
    } else if (guidance.detectorStatus === "loading") {
      instruction = "Getting guidance ready…";
    }
  } else if (holdStill != null) {
    instruction = holdStill
      ? "You're steady. Take the shot when you're ready"
      : "Hold the phone still";
    positive = holdStill;
  }

  return (
    <View style={styles.full}>
      <ScanCamera
        ref={scanRef}
        step={step}
        resetKey={`${current}-${attempt}`}
        active={cameraSessionActive}
        onReady={() => {
          setCameraReady(true);
          setCaptureNotice(null);
        }}
        onGuidance={handleGuidance}
        onError={handleCameraError}
        onCapture={handleCapture}
      />
      <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
        <View style={styles.topText}>
          <ProgressDots count={STEP_ORDER.length} index={current} />
          <AppText
            variant="headline"
            color={colors.guideActive}
            style={styles.shadowText}
          >
            {step.title}
          </AppText>
          <AppText
            variant="caption"
            color={colors.guideActive}
            style={styles.shadowText}
          >
            {step.hint}
          </AppText>
        </View>

        <ScanGuidanceOverlay
          guideState={guideState}
          instruction={instruction}
          positive={positive}
          countdown={guidance.countdown}
          status={guidance.status}
          direction={step.screenDirection}
          active={cameraSessionActive}
        />
        {__DEV__ ? <ScanDebugOverlay debug={guidance.debug} /> : null}

        <View style={styles.bottomControls}>
          {!manualCaptureReady ? (
            <AppText
              variant="caption"
              color={colors.guideActive}
              style={styles.shadowText}
              accessibilityLiveRegion={captureNotice ? "polite" : "none"}
            >
              {captureNotice ??
                "The shutter unlocks when this frame passes quality checks."}
            </AppText>
          ) : null}
          <View style={styles.bottomBar}>
            {leaveAction}
            <Pressable
              onPress={() => {
                if (scanRef.current?.capture() !== true) {
                  setCaptureNotice(
                    "That quality frame expired. Hold steady for the shutter to unlock again.",
                  );
                }
              }}
              disabled={!manualCaptureReady}
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              accessibilityHint="Available after the live frame passes quality checks"
              accessibilityState={{ disabled: !manualCaptureReady }}
              style={[
                styles.shutterOuter,
                !manualCaptureReady && styles.shutterDisabled,
              ]}
            >
              <View style={styles.shutterInner} />
            </Pressable>
            {/* spacer to keep the shutter centered */}
            <View style={styles.edgeAction} />
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    full: { flex: 1, backgroundColor: colors.cameraSurface },
    permissionLoading: {
      flexGrow: 1,
      justifyContent: "center",
    },
    permissionLoadingContent: {
      alignItems: "center",
      gap: spacing.sm,
    },
    centerText: { textAlign: "center" },
    overlay: { flex: 1, justifyContent: "space-between" },
    topText: {
      alignItems: "center",
      gap: spacing.xs,
      paddingTop: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    shadowText: {
      textAlign: "center",
      textShadowColor: colors.cameraScrim,
      textShadowOffset: { width: 0, height: 1 },
      textShadowRadius: 4,
    },
    bottomBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: spacing.xl,
      paddingBottom: spacing.lg,
    },
    edgeAction: {
      width: touchTarget.min,
      minHeight: touchTarget.min,
      alignItems: "center",
      justifyContent: "center",
    },
    bottomControls: { gap: spacing.sm },
    shutterOuter: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: borderWidth.ring,
      borderColor: colors.guideActive,
      alignItems: "center",
      justifyContent: "center",
    },
    shutterInner: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.guideActive,
    },
    shutterDisabled: { opacity: 0.38 },
    previewImage: { flex: 1, borderRadius: radius.lg, margin: spacing.md },
    previewActions: { gap: spacing.sm, padding: spacing.lg },
    previewBottomBar: {
      alignItems: "center",
      paddingBottom: spacing.lg,
    },
    recoveryScreen: { flexGrow: 1, justifyContent: "center" },
    recoveryCard: {
      gap: spacing.md,
      backgroundColor: colors.surfaceElevated,
      borderWidth: borderWidth.hairline,
      borderColor: colors.border,
      borderRadius: radius.lg,
      padding: spacing.lg,
    },
    recoveryMessage: { gap: spacing.xs },
  });
}
