/** Truthful result from the strict final gate for the exact analysis JPEG. */
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import type { ThemeColors } from "@pore/shared";
import type { StepId } from "@pore/shared/scan";

import type { ScanCaptureArtifact } from "@/lib/scan-session";
import { AppText, radius, spacing, useThemeColors } from "@/theme";

interface BannerContent {
  fill: string;
  tone: string;
  title: string;
  detail: string;
}

function bannerContent(
  stepId: StepId,
  artifact: ScanCaptureArtifact | null,
  checkComplete: boolean,
  colors: ThemeColors,
): BannerContent {
  if (!checkComplete) {
    return {
      fill: colors.infoSoft,
      tone: colors.onInfo,
      title: "Verifying this photo",
      detail:
        "Checking the exact photo for face, angle, lighting, sharpness, and file integrity.",
    };
  }
  if (!artifact) {
    return {
      fill: colors.warningSoft,
      tone: colors.onWarning,
      title: "Photo not verified",
      detail: `Pore couldn't verify the ${stepId} photo. Retake it to use photo analysis.`,
    };
  }
  if (artifact.kind === "verified") {
    return {
      fill: colors.successSoft,
      tone: colors.onSuccess,
      title: "Verified for analysis",
      detail:
        "This exact photo passed Pore's face, pose, light, sharpness, and integrity checks.",
    };
  }
  const webOnly = artifact.reason.code === "web_timeline_only";
  return {
    fill: colors.warningSoft,
    tone: colors.onWarning,
    title: webOnly ? "Timeline photo only" : "Retake needed for analysis",
    detail: artifact.reason.message,
  };
}

export function ScanVerdictBanner({
  stepId,
  artifact,
  checkComplete = true,
}: {
  stepId: StepId;
  artifact: ScanCaptureArtifact | null;
  checkComplete?: boolean;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { fill, tone, title, detail } = bannerContent(
    stepId,
    artifact,
    checkComplete,
    colors,
  );
  return (
    <View
      accessible
      accessibilityRole="alert"
      accessibilityLabel={`${title}. ${detail}`}
      accessibilityLiveRegion="polite"
      style={styles.banner}
    >
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: fill, borderRadius: radius.md },
        ]}
      />
      <View style={[styles.dot, { backgroundColor: tone }]} />
      <View style={styles.text}>
        <AppText variant="bodyStrong" color={tone}>
          {title}
        </AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          {detail}
        </AppText>
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    banner: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      backgroundColor: colors.surfaceElevated,
      borderRadius: radius.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    dot: { width: 8, height: 8, borderRadius: radius.pill },
    text: { flex: 1, gap: spacing.xxs },
  });
}
