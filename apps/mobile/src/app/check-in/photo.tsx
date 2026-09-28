/**
 * Single-shot progress photo for the check-in — a stripped-down version of
 * the scan flow's guided capture (one angle, same permission gate).
 */
import { CameraView, useCameraPermissions } from "expo-camera";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import type { ThemeColors } from "@pore/shared";
import { CameraPermissionGate } from "@/components/CameraPermissionGate";
import { checkInPhotoPrivacyLine } from "@/lib/analysis-status";
import { updateDraft } from "@/lib/check-in-session";
import {
  AppText,
  PrimaryButton,
  Screen,
  TextButton,
  borderWidth,
  radius,
  spacing,
  touchTarget,
  useThemeColors,
} from "@/theme";

export default function CheckInPhoto() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraGranted, setCameraGranted] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [captureError, setCaptureError] = useState<string | null>(null);

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
        body={checkInPhotoPrivacyLine()}
        permission={permission}
        requestPermission={requestPermission}
        onGranted={() => setCameraGranted(true)}
        secondaryLabel="Go back"
        onSecondary={() => router.back()}
      />
    );
  }

  const confirmShot = () => {
    if (!preview) return;
    updateDraft({ photoUri: preview });
    router.back();
  };

  if (preview) {
    return (
      <SafeAreaView style={styles.full} edges={["top", "bottom"]}>
        <Image
          source={{ uri: preview }}
          style={styles.previewImage}
          contentFit="cover"
          accessible
          accessibilityLabel="Check-in photo preview"
        />
        <View style={styles.previewActions}>
          <AppText
            variant="caption"
            color={colors.guideActive}
            style={styles.shadowText}
          >
            This photo is not auto-checked. Confirm that it is sharp, evenly
            lit, and matches your usual angle.
          </AppText>
          <PrimaryButton label="Use this photo" onPress={confirmShot} />
          <TextButton
            label="Retake"
            tone={colors.guideActive}
            onPress={() => {
              setCaptureError(null);
              setPreview(null);
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  const takeShot = async () => {
    if (busy) return;
    setBusy(true);
    setCaptureError(null);
    try {
      const photo = await cameraRef.current?.takePictureAsync({ quality: 0.9 });
      if (photo?.uri) {
        setPreview(photo.uri);
      } else {
        setCaptureError("The camera did not return a photo. Try again.");
      }
    } catch {
      setCaptureError(
        "Pore couldn't take the photo. Hold the phone still and try again.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.full}>
      <CameraView
        ref={cameraRef}
        facing="front"
        style={StyleSheet.absoluteFill}
      />
      <SafeAreaView style={styles.overlay} edges={["top", "bottom"]}>
        <View style={styles.topText}>
          <AppText
            variant="headline"
            color={colors.guideActive}
            style={styles.shadowText}
          >
            Match your previous photo
          </AppText>
          <AppText
            variant="caption"
            color={colors.guideActive}
            style={styles.shadowText}
          >
            Pore does not auto-check this photo. Use similar light, distance,
            and angle each week.
          </AppText>
        </View>

        <View style={styles.bottomControls}>
          {captureError ? (
            <AppText
              variant="caption"
              color={colors.guideActive}
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              style={styles.shadowText}
            >
              {captureError}
            </AppText>
          ) : null}
          <View style={styles.bottomBar}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Cancel check-in photo"
              style={styles.edgeAction}
            >
              <AppText
                variant="bodyStrong"
                color={colors.guideActive}
                style={styles.shadowText}
              >
                Cancel
              </AppText>
            </Pressable>
            <Pressable
              onPress={takeShot}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Take check-in photo"
              accessibilityHint="Takes one front-facing photo for progress comparison"
              accessibilityState={{ disabled: busy, busy }}
              style={[styles.shutterOuter, busy && styles.shutterDisabled]}
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
    permissionLoading: { flexGrow: 1, justifyContent: "center" },
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
    bottomControls: { gap: spacing.sm },
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
  });
}
