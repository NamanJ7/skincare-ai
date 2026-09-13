import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ThemeColors } from "@pore/shared";

import { calibrationLogSize } from "@/lib/scan/calibration-log";
import type { LiveGuidanceDebug } from "@/lib/scan/live-guidance-types";
import { shareCalibrationLog } from "@/lib/scan/share-calibration-log";
import { radius, spacing, useThemeColors } from "@/theme";

export function ScanDebugOverlay({
  debug,
}: {
  debug?: LiveGuidanceDebug;
}): React.JSX.Element | null {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  if (!__DEV__ || !debug) return null;
  const number = (value: number | null, digits = 1) =>
    value == null ? "-" : value.toFixed(digits);
  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <Text pointerEvents="none" style={styles.text}>
        {[
          `phase=${debug.phase} raw=${debug.rawVerdict.level}/${debug.rawVerdict.code} stable=${debug.stable}`,
          `face=${debug.faceCount} yaw=${number(debug.yawDeg)} pitch=${number(debug.pitchDeg)} width=${number(debug.widthRatio, 2)}`,
          `packet=${number(debug.packetAgeMs, 0)}ms mirrored=${debug.frameMirrored ?? "-"} override=${debug.overrideCode ?? "-"} armed=${debug.armedHash ?? "-"}`,
          `p10/p90=${number(debug.lumaP10, 0)}/${number(debug.lumaP90, 0)} glare=${number(debug.glareRatio, 3)} grad=${number(debug.gradientEnergy)} lap=${number(debug.laplacianVariance)}`,
          `backlight=${number(debug.backlightDelta)} cheeks=${number(debug.cheekLumaDifference, 3)} error=${debug.evidenceError ?? "-"}`,
        ].join("\n")}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Export scan calibration log"
        onPress={() => void shareCalibrationLog()}
        style={styles.exportButton}
      >
        <Text style={styles.exportText}>
          Export QA log ({calibrationLogSize()})
        </Text>
      </Pressable>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      position: "absolute",
      left: spacing.sm,
      right: spacing.sm,
      bottom: 104,
      padding: spacing.xs,
      backgroundColor: colors.cameraScrim,
    },
    text: {
      color: colors.guidePositive,
      fontFamily: "monospace",
      fontSize: 10,
      lineHeight: 14,
    },
    exportButton: {
      alignSelf: "flex-start",
      marginTop: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      backgroundColor: colors.guidePositive,
    },
    exportText: {
      color: colors.cameraSurface,
      fontSize: 11,
      fontWeight: "700",
    },
  });
}
