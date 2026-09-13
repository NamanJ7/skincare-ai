import { Image } from "expo-image";
import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import type { ThemeColors } from "@pore/shared";
import type { ObservedRegion } from "@/lib/results";
import { AppText, radius, spacing, useThemeColors } from "@/theme";

function usePoreLensTheme() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return { colors, styles };
}

export interface PoreLensMarker {
  rank: number;
  title: string;
  region: ObservedRegion;
}

export function PoreLens({
  source,
  photoUri,
  markers,
  selectedRank,
  hasPriorities,
  scanEvidenceAvailable = true,
  onSelect,
}: {
  source: "scan" | "answers";
  photoUri?: string;
  markers: PoreLensMarker[];
  selectedRank?: number;
  hasPriorities: boolean;
  scanEvidenceAvailable?: boolean;
  onSelect: (rank: number) => void;
}) {
  const { colors, styles } = usePoreLensTheme();
  const reduceMotion = useReducedMotion();
  const reveal = useSharedValue(reduceMotion ? 1 : 0);
  const [photoFailed, setPhotoFailed] = useState(false);
  const scanBased = source === "scan";
  const showPhoto = scanBased && Boolean(photoUri) && !photoFailed;
  const visibleMarkers = useMemo(
    () => (scanBased ? markers.slice(0, 3) : []),
    [markers, scanBased],
  );
  const selectedMarker =
    selectedRank === undefined
      ? visibleMarkers[0]
      : visibleMarkers.find((marker) => marker.rank === selectedRank);

  useEffect(() => {
    setPhotoFailed(false);
  }, [photoUri]);

  useEffect(() => {
    if (reduceMotion) {
      reveal.value = 1;
      return;
    }
    reveal.value = 0;
    reveal.value = withTiming(1, {
      duration: 320,
      easing: Easing.out(Easing.cubic),
    });
  }, [reduceMotion, reveal]);

  const revealStyle = useAnimatedStyle(() => ({
    opacity: reveal.value,
    transform: [
      { translateY: (1 - reveal.value) * 6 },
      { scale: 0.985 + reveal.value * 0.015 },
    ],
  }));

  return (
    <Animated.View style={[styles.lens, revealStyle]}>
      <View style={styles.visual}>
        {scanBased ? (
          <>
            {showPhoto ? (
              <Image
                source={{ uri: photoUri }}
                contentFit="cover"
                transition={reduceMotion ? 0 : 180}
                onError={() => setPhotoFailed(true)}
                accessible={false}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <NeutralFace />
            )}
            <View pointerEvents="none" style={styles.photoVeil} />
            {selectedMarker ? (
              <View
                pointerEvents="none"
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={[
                  styles.regionHighlight,
                  REGION_ZONES[selectedMarker.region],
                ]}
              />
            ) : null}
          </>
        ) : (
          <AnswerArtwork />
        )}
      </View>

      <View style={styles.footer}>
        {scanBased ? (
          <>
            <AppText variant="caption" color={colors.textSecondary}>
              {selectedMarker
                ? showPhoto
                  ? "The highlighted ribbon shows the selected priority's broad region, not an exact spot."
                  : "Your scan photo is unavailable, so Pore is showing a neutral face guide. The highlighted ribbon is a broad region, not an exact spot."
                : hasPriorities
                  ? `${showPhoto ? "" : "Your scan photo is unavailable, so Pore is showing a neutral face guide. "}This selected priority did not return a supported broad facial region, so Pore is not placing a ribbon on the face guide.`
                  : `${showPhoto ? "" : "Your scan photo is unavailable, so Pore is showing a neutral face guide. "}Pore did not find a clear visual priority to place on the face guide.`}
            </AppText>
            {visibleMarkers.length > 0 ? (
              <View style={styles.markerRail}>
                {visibleMarkers.map((marker) => {
                  const selected = marker.rank === selectedRank;
                  return (
                    <Pressable
                      key={`${marker.rank}-${marker.title}`}
                      onPress={() => onSelect(marker.rank)}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      aria-pressed={selected}
                      accessibilityLabel={`Priority ${marker.rank}, ${marker.title}, most visible around ${regionLabel(marker.region)}`}
                      style={({ pressed }) => [
                        styles.markerChoice,
                        selected && styles.markerChoiceSelected,
                        pressed && styles.markerPressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.markerRank,
                          selected && styles.markerRankSelected,
                        ]}
                      >
                        <AppText
                          variant="bodyStrong"
                          color={
                            selected
                              ? colors.onActionPrimary
                              : colors.actionPrimary
                          }
                        >
                          {marker.rank}
                        </AppText>
                      </View>
                      <AppText
                        variant="caption"
                        color={
                          selected ? colors.actionPrimary : colors.textPrimary
                        }
                        style={styles.markerLabel}
                      >
                        {shortRegionLabel(marker.region)}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
          </>
        ) : (
          <>
            <AppText variant="overline" color={colors.info}>
              YOUR CONCERNS
            </AppText>
            <AppText variant="heading" color={colors.actionPrimary}>
              A plan shaped by what you shared
            </AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              {scanEvidenceAvailable
                ? "A guided scan can add visual evidence when you're ready. Your complete answer-based routine is still available."
                : "Visual scan evidence isn't connected in this build. Your complete answer-based routine is still available."}
            </AppText>
          </>
        )}
      </View>
    </Animated.View>
  );
}

/**
 * Broad, bilateral region ribbons. Only the selected one is visible; numbered
 * controls live in the flow below the image, so adjacent regions and Dynamic
 * Type can never overlap or shrink a touch target.
 */
const REGION_ZONES: Record<ObservedRegion, ViewStyle> = {
  forehead: { top: "7%", left: "15%", width: "70%", height: "24%" },
  temples: { top: "20%", left: "5%", width: "90%", height: "24%" },
  "under-eye": { top: "29%", left: "12%", width: "76%", height: "18%" },
  cheeks: { top: "35%", left: "8%", width: "84%", height: "30%" },
  nose: { top: "29%", left: "30%", width: "40%", height: "34%" },
  "around mouth": { top: "49%", left: "20%", width: "60%", height: "22%" },
  jaw: { top: "55%", left: "8%", width: "84%", height: "32%" },
  chin: { top: "64%", left: "25%", width: "50%", height: "24%" },
};

function regionLabel(region: ObservedRegion): string {
  if (region === "under-eye") return "your under-eye area";
  if (region === "around mouth") return "the area around your mouth";
  return `your ${region}`;
}

function shortRegionLabel(region: ObservedRegion): string {
  if (region === "under-eye") return "Under-eye";
  if (region === "around mouth") return "Mouth area";
  return `${region.charAt(0).toUpperCase()}${region.slice(1)}`;
}

function NeutralFace() {
  const { styles } = usePoreLensTheme();
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={styles.neutralArt}
    >
      <View style={styles.neutralHalo} />
      <View style={styles.neutralShoulders} />
      <View style={styles.neutralNeck} />
      <View style={styles.neutralFace}>
        <View style={styles.neutralEyes}>
          <View style={styles.neutralEye} />
          <View style={styles.neutralEye} />
        </View>
        <View style={styles.neutralNose} />
        <View style={styles.neutralMouth} />
      </View>
    </View>
  );
}

function AnswerArtwork() {
  const { styles } = usePoreLensTheme();
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={styles.answerArt}
    >
      <View style={[styles.answerOrb, styles.answerOrbLarge]} />
      <View style={[styles.answerOrb, styles.answerOrbSmall]} />
      <View style={styles.answerPath}>
        <View style={styles.answerDot} />
        <View style={styles.answerLine} />
        <View style={[styles.answerDot, styles.answerDotLavender]} />
        <View style={styles.answerLine} />
        <View style={styles.answerDot} />
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    lens: {
      overflow: "hidden",
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.infoSoft,
    },
    visual: {
      position: "relative",
      width: "100%",
      aspectRatio: 1.05,
      overflow: "hidden",
      backgroundColor: colors.infoSoft,
    },
    photoVeil: {
      position: "absolute",
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      backgroundColor: colors.overlay,
      opacity: 0.12,
    },
    footer: {
      minHeight: 56,
      justifyContent: "center",
      gap: spacing.xxs,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    regionHighlight: {
      position: "absolute",
      zIndex: 3,
      borderWidth: 2,
      borderColor: colors.gold,
      borderRadius: radius.pill,
      backgroundColor: colors.overlay,
    },
    markerRail: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: spacing.xs,
    },
    markerChoice: {
      minWidth: 96,
      minHeight: 44,
      flexBasis: 96,
      flexGrow: 1,
      flexShrink: 1,
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.xs,
      padding: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: colors.background,
    },
    markerChoiceSelected: {
      borderWidth: 2,
      borderColor: colors.actionPrimary,
      backgroundColor: colors.infoSoft,
    },
    markerRank: {
      minWidth: 32,
      minHeight: 32,
      flexShrink: 0,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.xs,
      paddingVertical: spacing.xxs,
      borderWidth: 1,
      borderColor: colors.gold,
      borderRadius: radius.pill,
      backgroundColor: colors.background,
    },
    markerRankSelected: {
      borderColor: colors.actionPrimary,
      backgroundColor: colors.actionPrimary,
    },
    markerLabel: { alignSelf: "stretch", minWidth: 0, textAlign: "center" },
    markerPressed: { opacity: 0.78 },
    neutralArt: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.infoSoft,
    },
    neutralHalo: {
      position: "absolute",
      width: "76%",
      aspectRatio: 1,
      borderRadius: radius.pill,
      backgroundColor: colors.primaryTintSoft,
    },
    neutralShoulders: {
      position: "absolute",
      bottom: "-14%",
      width: "82%",
      height: "42%",
      borderTopLeftRadius: radius.pill,
      borderTopRightRadius: radius.pill,
      backgroundColor: colors.border,
    },
    neutralNeck: {
      position: "absolute",
      bottom: "23%",
      width: "24%",
      height: "24%",
      borderRadius: radius.xl,
      backgroundColor: colors.background,
    },
    neutralFace: {
      width: "47%",
      height: "56%",
      alignItems: "center",
      justifyContent: "center",
      gap: spacing.lg,
      borderRadius: radius.pill,
      borderWidth: 2,
      borderColor: colors.actionPrimary,
      backgroundColor: colors.background,
    },
    neutralEyes: {
      width: "58%",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    neutralEye: {
      width: 18,
      height: 2,
      borderRadius: radius.pill,
      backgroundColor: colors.textSecondary,
    },
    neutralNose: {
      width: 2,
      height: 24,
      borderRadius: radius.pill,
      backgroundColor: colors.border,
    },
    neutralMouth: {
      width: 34,
      height: 2,
      borderRadius: radius.pill,
      backgroundColor: colors.textSecondary,
    },
    answerArt: {
      flex: 1,
      padding: spacing.lg,
      backgroundColor: colors.infoSoft,
    },
    answerOrb: {
      position: "absolute",
      borderRadius: radius.pill,
    },
    answerOrbLarge: {
      width: "78%",
      aspectRatio: 1,
      right: "-18%",
      top: "-8%",
      backgroundColor: colors.infoSoft,
    },
    answerOrbSmall: {
      width: "38%",
      aspectRatio: 1,
      left: "-8%",
      top: "30%",
      backgroundColor: colors.primaryTint,
    },
    answerPath: {
      position: "absolute",
      top: "18%",
      left: "20%",
      flexDirection: "row",
      alignItems: "center",
    },
    answerDot: {
      width: 14,
      height: 14,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: colors.actionPrimary,
      backgroundColor: colors.background,
    },
    answerDotLavender: {
      borderColor: colors.info,
      backgroundColor: colors.infoSoft,
    },
    answerLine: {
      width: 42,
      height: 2,
      backgroundColor: colors.gold,
    },
  });
}
