/**
 * Review the three captures, then assemble a QUALITY-VALIDATED submission
 * (buildAnalysisSubmission runs the shared final gate on each still and binds
 * the exact submitted bytes by SHA-256) and hand it to generating via the
 * in-memory scan session. Analysis is fail-closed: if a valid session can't be
 * assembled (for example, because a photo fails its quality gate), the user
 * retakes the affected angle before continuing.
 */
import {
  Redirect,
  router,
  useFocusEffect,
  useLocalSearchParams,
} from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import type { ThemeColors } from "@pore/shared";
import { STEP_CONFIGS, STEP_ORDER } from "@pore/shared/scan";

import { photoPrivacyLine } from "@/lib/analysis-status";
import { track } from "@/lib/analytics";
import { hasCurrentPhotoAnalysisConsent } from "@/lib/consent";
import type { ScanMode } from "@/lib/nav";
import { persistScanShots } from "@/lib/photos";
import { buildAnalysisSubmission } from "@/lib/scan/session-builder";
import {
  clearShots,
  getScanCaptureSession,
  getShots,
  setPendingScanAttempt,
  type ScanShot,
} from "@/lib/scan-session";
import { useOnboarding } from "@/state/onboarding";
import {
  AppText,
  PhotoThumb,
  PrimaryButton,
  Screen,
  TextButton,
  radius,
  spacing,
  touchTarget,
  useThemeColors,
} from "@/theme";

/** Grid labels in capture order — front, right cheek, left cheek. */
const ANGLE_NAMES = STEP_ORDER.map((id) => STEP_CONFIGS[id].label);

export default function Review() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode: ScanMode = params.mode === "rescan" ? "rescan" : "onboarding";
  const { data } = useOnboarding();
  const [shots, setShots] = useState<ScanShot[]>(getShots());
  const [processing, setProcessing] = useState(false);
  const [validationFailure, setValidationFailure] = useState<{
    code: string;
    message: string;
    stepId?: (typeof STEP_ORDER)[number];
  } | null>(null);

  // Re-read after a single-angle retake pops back to this screen.
  useFocusEffect(
    useCallback(() => {
      setShots(getShots());
      setValidationFailure(null);
    }, []),
  );

  if (!hasCurrentPhotoAnalysisConsent(data.photoAnalysisConsent)) {
    return <Redirect href={`/scan-flow?mode=${mode}`} />;
  }

  const routeToGenerating = () => {
    clearShots();
    router.replace(
      mode === "rescan"
        ? "/onboarding/generating?next=/(tabs)"
        : "/onboarding/generating",
    );
  };

  const persistSelected = async (selected: ScanShot[]) =>
    persistScanShots(selected.map((shot) => shot.uri)).catch(
      () => [] as string[],
    );

  const usePhotos = async () => {
    if (processing) return;
    setProcessing(true);
    setValidationFailure(null);
    // Every escape hatch on this screen (per-angle Retake, Continue, Retake all)
    // is gated on `!processing`, so an unwound `processing` leaves the user with
    // no tappable control at all. It must be released on every path.
    let advanced = false;
    try {
      const selected = shots.filter((shot) => Boolean(shot?.uri)).slice(0, 3);
      track("scan_completed", { mode, photo_count: selected.length });
      const timelineOnly = selected.find(
        (shot) => shot.artifact.kind === "timeline-only",
      );

      // Fail closed: a blocked photo must be retaken before we prepare a scan.
      if (timelineOnly?.artifact.kind === "timeline-only") {
        setValidationFailure({
          code: timelineOnly.artifact.reason.code,
          message: timelineOnly.artifact.reason.message,
          stepId: timelineOnly.artifact.stepId,
        });
        return;
      }

      const captureSession = getScanCaptureSession();
      if (!captureSession) {
        setValidationFailure({
          code: "wrong_session",
          message: "This scan session expired. Retake the photos to continue.",
        });
        return;
      }

      const submission = await buildAnalysisSubmission(selected, captureSession);

      if (!submission.ok) {
        setValidationFailure({
          code: submission.code,
          message: submission.message,
          stepId: submission.stepId,
        });
        return;
      }

      const persisted = await persistSelected(selected);
      setPendingScanAttempt({
        submission: {
          session: submission.session,
          images: submission.images,
        },
        comparisonMetadata: submission.comparisonMetadata,
        photoNames: persisted,
      });
      // `scannedAt` means successful analysis; generating sets it only after the
      // API succeeds, so a failed attempt cannot backdate a scan.
      advanced = true;
      routeToGenerating();
    } catch (cause) {
      setValidationFailure({
        code: "processing_failed",
        message:
          cause instanceof Error
            ? cause.message
            : "Pore couldn't prepare these photos. Retake them and try again.",
      });
    } finally {
      // Leave the spinner up on the way out so the screen doesn't flash back to
      // its idle state during the navigation to generating.
      if (!advanced) setProcessing(false);
    }
  };

  /**
   * A build with no on-device validator (web) can never turn these photos into
   * a verified scan, so "Retake" would loop forever. Keep the photos for the
   * timeline and continue to a routine that is explicitly labelled answer-based
   * — analysis still fails closed, it just no longer dead-ends.
   */
  const continueWithoutAnalysis = async () => {
    if (processing || !validationFailure) return;
    setProcessing(true);
    try {
      const selected = shots.filter((shot) => Boolean(shot?.uri)).slice(0, 3);
      const persisted = await persistSelected(selected);
      setPendingScanAttempt({
        submission: null,
        photoNames: persisted,
        buildFailure: {
          code: validationFailure.code,
          message: validationFailure.message,
        },
      });
      routeToGenerating();
    } catch {
      setProcessing(false);
    }
  };

  if (shots.filter((shot) => Boolean(shot?.uri)).length < 3) {
    // Shouldn't happen (capture guards the sequence), but never dead-end.
    return <Redirect href={`/scan-flow/capture?mode=${mode}`} />;
  }

  return (
    <Screen contentStyle={{ paddingTop: spacing.section }}>
      <AppText variant="titleSans">Review your photos</AppText>
      <AppText variant="body" color={colors.textSecondary}>
        Each photo has passed Pore's final check and is ready for analysis.
      </AppText>

      <View style={styles.grid}>
        {shots.map((shot, i) => (
          <View key={`${shot.uri}-${i}`} style={styles.cell}>
            <PhotoThumb uri={shot.uri} />
            <AppText
              variant="label"
              color={colors.textSecondary}
              style={{ textAlign: "center" }}
            >
              {ANGLE_NAMES[i]}
            </AppText>
            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    shot.artifact.kind === "verified"
                      ? colors.successSoft
                      : colors.warningSoft,
                },
              ]}
            >
              <AppText
                variant="caption"
                color={
                  shot.artifact.kind === "verified"
                    ? colors.onSuccess
                    : colors.onWarning
                }
                style={{ textAlign: "center" }}
              >
                {shot.artifact.kind === "verified"
                  ? "Verified"
                  : "Retake needed"}
              </AppText>
            </View>
            {!processing && (
              <Pressable
                onPress={() =>
                  router.push(`/scan-flow/capture?mode=${mode}&angle=${i}`)
                }
                accessibilityRole="button"
                accessibilityLabel={`Retake ${ANGLE_NAMES[i]} photo`}
                accessibilityHint="Opens the camera to replace only this angle"
                style={({ pressed }) => [
                  styles.retake,
                  pressed && styles.retakePressed,
                ]}
              >
                <AppText
                  variant="caption"
                  color={colors.link}
                  style={{ textAlign: "center" }}
                >
                  Retake
                </AppText>
              </Pressable>
            )}
          </View>
        ))}
      </View>

      <View style={{ gap: spacing.xs, marginTop: spacing.md }}>
        {validationFailure ? (
          <View
            style={styles.validationFailure}
            accessible
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
          >
            <AppText variant="bodyStrong">
              {validationFailure.code === "web_timeline_only"
                ? "Photo analysis isn't available here"
                : "This photo needs another try"}
            </AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              {validationFailure.message}
            </AppText>
            {validationFailure.code === "web_timeline_only" ? (
              <PrimaryButton
                label="Continue without photo analysis"
                onPress={continueWithoutAnalysis}
                loading={processing}
              />
            ) : (
              <PrimaryButton
                label={
                  validationFailure.stepId
                    ? `Retake ${STEP_CONFIGS[validationFailure.stepId].label}`
                    : "Retake photos"
                }
                onPress={() => {
                  if (validationFailure.stepId) {
                    const index = STEP_ORDER.indexOf(validationFailure.stepId);
                    router.push(
                      `/scan-flow/capture?mode=${mode}&angle=${index}`,
                    );
                  } else {
                    clearShots();
                    router.replace(`/scan-flow/capture?mode=${mode}`);
                  }
                }}
              />
            )}
          </View>
        ) : null}
        {!validationFailure ? (
          <PrimaryButton
            label="Continue"
            onPress={usePhotos}
            loading={processing}
          />
        ) : null}
        {processing ? (
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Validating and preparing your photos"
            accessibilityLiveRegion="polite"
          >
            <AppText
              variant="caption"
              color={colors.textSecondary}
              style={{ textAlign: "center" }}
            >
              Validating and preparing your photos…
            </AppText>
          </View>
        ) : (
          // Shown in the failure state too: it is the one control that always
          // gets the user out of a rejected set.
          <TextButton
            label="Retake all"
            onPress={() => {
              clearShots();
              router.replace(`/scan-flow/capture?mode=${mode}`);
            }}
          />
        )}
      </View>

      <AppText
        variant="caption"
        color={colors.textSecondary}
        style={{ textAlign: "center" }}
      >
        {photoPrivacyLine()}
      </AppText>
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    grid: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
    cell: { flex: 1, gap: spacing.xs },
    statusBadge: {
      alignSelf: "center",
      borderRadius: radius.pill,
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xxs,
    },
    retake: {
      minHeight: touchTarget.min,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: radius.sm,
    },
    retakePressed: { backgroundColor: colors.infoSoft },
    validationFailure: {
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceElevated,
    },
  });
}
