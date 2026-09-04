/**
 * HeroDemo — a self-contained, looping "live" skin-scan demo shown on the
 * landing screen. A phone frame plays the whole flow on repeat: a face is
 * framed and scanned, then an analysis sheet slides up with a skin score,
 * concern chips, and a mini routine.
 *
 * It's intentionally self-contained (no real data/photos) so it's beautiful and
 * dependency-free today. It's structured so the analysis sheet can later be
 * swapped for / derived from the real results UI. The entire choreography is
 * driven by one looping `progress` value via interpolation.
 */
import { useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { AppText, colors, overlay, radius, spacing } from "@/theme";

const LOOP_MS = 6200;

const { width: screenW, height: screenH } = Dimensions.get("window");
// Sized off both axes so the hero fits without scrolling on shorter phones.
const PHONE_W = Math.max(180, Math.min(screenW * 0.58, screenH * 0.27));
const PHONE_H = PHONE_W * 2.03;
const BEZEL = 7;
const INNER_W = PHONE_W - BEZEL * 2;
const INNER_H = PHONE_H - BEZEL * 2;
const CAM_H = INNER_H * 0.6;
const TRACK_W = INNER_W - spacing.md * 2 - spacing.md * 2; // sheet padding both sides

export function HeroDemo() {
  const progress = useSharedValue(0);
  /**
   * This loops forever on the landing screen with no way to pause it, which is
   * the single clearest thing on the phone for "reduce motion" to switch off.
   * Parked at the point in the loop where the results are on screen, so the
   * still frame still shows what the product does.
   */
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 0.6;
      return;
    }
    progress.value = 0;
    progress.value = withRepeat(
      withTiming(1, { duration: LOOP_MS, easing: Easing.linear }),
      -1,
      false,
    );
  }, [reduceMotion]);

  // --- Scanning phase (0 .. 0.30) -----------------------------------------
  const scanLineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.04, 0.28, 0.32], [0, 1, 1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(
          progress.value,
          [0, 0.15, 0.3],
          [12, CAM_H - 40, 12],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const reticleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.05, 0.3, 0.34], [0, 1, 1, 0], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(progress.value, [0, 0.15, 0.3], [1, 1.04, 1], Extrapolation.CLAMP) },
    ],
  }));

  const analyzingStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.05, 0.27, 0.31], [0, 1, 1, 0], Extrapolation.CLAMP),
  }));

  // --- Results sheet (0.30 .. 0.98) ---------------------------------------
  const sheetStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.3, 0.42, 0.92, 0.98], [0, 1, 1, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(
          progress.value,
          [0.3, 0.42, 0.92, 0.98],
          [70, 0, 0, 24],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const scoreStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.42, 0.5], [0, 1], Extrapolation.CLAMP),
    transform: [
      { scale: interpolate(progress.value, [0.42, 0.52], [0.6, 1], Extrapolation.CLAMP) },
    ],
  }));

  const barStyle = useAnimatedStyle(() => ({
    width: interpolate(progress.value, [0.46, 0.62], [0, TRACK_W * 0.82], Extrapolation.CLAMP),
  }));

  // Staggered chip reveals (kept as explicit hooks to respect rules-of-hooks).
  const chip1 = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.52, 0.58], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(progress.value, [0.52, 0.58], [8, 0], Extrapolation.CLAMP) }],
  }));
  const chip2 = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.56, 0.62], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(progress.value, [0.56, 0.62], [8, 0], Extrapolation.CLAMP) }],
  }));
  const chip3 = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.6, 0.66], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(progress.value, [0.6, 0.66], [8, 0], Extrapolation.CLAMP) }],
  }));

  const routineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.66, 0.74], [0, 1], Extrapolation.CLAMP),
    transform: [
      { translateY: interpolate(progress.value, [0.66, 0.74], [8, 0], Extrapolation.CLAMP) },
    ],
  }));

  const dotStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.06, 0.12, 0.18, 0.24, 0.3],
      [1, 0.3, 1, 0.3, 1, 0.3],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View style={styles.phone}>
      <View style={styles.screen}>
        {/* notch */}
        <View style={styles.notch} />

        {/* status bar */}
        <View style={styles.statusBar}>
          <AppText variant="label" color={colors.ink} style={styles.statusTime}>
            9:41
          </AppText>
          <View style={styles.statusIcons}>
            <View style={[styles.bar, { height: 5 }]} />
            <View style={[styles.bar, { height: 7 }]} />
            <View style={[styles.bar, { height: 9 }]} />
            <View style={styles.battery} />
          </View>
        </View>

        {/* camera / face region */}
        <View style={styles.cam}>
          <FaceSilhouette />
          {/* corner focus ticks */}
          <View style={[styles.tick, styles.tickTL]} />
          <View style={[styles.tick, styles.tickTR]} />
          <View style={[styles.tick, styles.tickBL]} />
          <View style={[styles.tick, styles.tickBR]} />
          {/* oval reticle */}
          <Animated.View style={[styles.reticle, reticleStyle]} />
          {/* sweeping scan line */}
          <Animated.View style={[styles.scanLine, scanLineStyle]} />
          {/* analyzing pill */}
          <Animated.View style={[styles.analyzing, analyzingStyle]}>
            <Animated.View style={[styles.liveDot, dotStyle]} />
            <AppText variant="label" color={colors.onPrimary}>
              ANALYZING SKIN
            </AppText>
          </Animated.View>
        </View>

        {/* results sheet */}
        <Animated.View style={[styles.sheet, sheetStyle]}>
          <View style={styles.sheetHandle} />
          <AppText variant="heading" color={colors.ink}>
            Skin analysis
          </AppText>

          <View style={styles.scoreRow}>
            <Animated.View style={scoreStyle}>
              <AppText variant="title" color={colors.primary} style={styles.scoreNum}>
                82
              </AppText>
            </Animated.View>
            <View style={styles.scoreMeta}>
              <AppText variant="caption" color={colors.inkMuted}>
                Skin Score
              </AppText>
              <View style={styles.track}>
                <Animated.View style={[styles.fill, barStyle]} />
              </View>
            </View>
          </View>

          <View style={styles.chips}>
            <Animated.View style={[styles.chip, chip1]}>
              <AppText variant="label" color={colors.ink}>
                Mild breakouts
              </AppText>
            </Animated.View>
            <Animated.View style={[styles.chip, styles.chipLav, chip2]}>
              <AppText variant="label" color={colors.accentInk}>
                Slight dryness
              </AppText>
            </Animated.View>
            <Animated.View style={[styles.chip, chip3]}>
              <AppText variant="label" color={colors.ink}>
                Even tone
              </AppText>
            </Animated.View>
          </View>

          <Animated.View style={[styles.routine, routineStyle]}>
            <AppText variant="label" color={colors.inkMuted}>
              YOUR AM ROUTINE
            </AppText>
            <AppText variant="caption" color={colors.ink}>
              Gentle cleanser · Vitamin C · SPF 30
            </AppText>
          </Animated.View>
        </Animated.View>
      </View>
    </View>
  );
}

function FaceSilhouette() {
  return (
    <View style={styles.face} pointerEvents="none">
      <View style={styles.head} />
      <View style={styles.shoulders} />
    </View>
  );
}



/**
 * The raw pixel values below are deliberate and are not design-token
 * violations. This is a *drawing of a phone* — a bezel radius, a notch, a
 * battery glyph — not app UI. A phone's corner radius has nothing to do with
 * the radius we give a card, and routing it through `radius.lg` would make both
 * values wrong the next time either changes. Colours are a different matter and
 * do come from tokens: those were real duplication.
 */
const styles = StyleSheet.create({
  phone: {
    width: PHONE_W,
    height: PHONE_H,
    borderRadius: 44,
    backgroundColor: colors.ink,
    padding: BEZEL,
    alignSelf: "center",
    shadowColor: colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  screen: {
    flex: 1,
    borderRadius: 38,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  notch: {
    position: "absolute",
    top: 8,
    alignSelf: "center",
    width: PHONE_W * 0.3,
    height: 18,
    borderRadius: 12,
    backgroundColor: colors.ink,
    zIndex: 5,
  },
  statusBar: {
    height: 34,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusTime: { fontSize: 11 },
  statusIcons: { flexDirection: "row", alignItems: "flex-end", gap: 2 },
  bar: { width: 3, borderRadius: 1, backgroundColor: colors.ink },
  battery: {
    width: 18,
    height: 9,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: colors.ink,
    marginLeft: 4,
  },
  cam: {
    height: CAM_H,
    backgroundColor: colors.hairline,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  face: { alignItems: "center", justifyContent: "flex-end", flex: 1, paddingTop: 26 },
  head: {
    width: INNER_W * 0.4,
    height: INNER_W * 0.5,
    borderRadius: INNER_W * 0.25,
    backgroundColor: overlay.inkTint,
  },
  shoulders: {
    width: INNER_W * 0.74,
    height: INNER_W * 0.4,
    borderTopLeftRadius: INNER_W * 0.37,
    borderTopRightRadius: INNER_W * 0.37,
    backgroundColor: overlay.inkTint,
    marginTop: 8,
  },
  reticle: {
    position: "absolute",
    width: INNER_W * 0.52,
    height: CAM_H * 0.62,
    borderRadius: INNER_W * 0.3,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  scanLine: {
    position: "absolute",
    top: 0,
    width: INNER_W * 0.72,
    height: 2,
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  analyzing: {
    position: "absolute",
    bottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.onPrimary },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    shadowColor: colors.ink,
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
  },
  sheetHandle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.hairline,
    marginBottom: 2,
  },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  scoreNum: { fontSize: 38, lineHeight: 42 },
  scoreMeta: { flex: 1, gap: 6 },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    overflow: "hidden",
  },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.primary },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surface,
  },
  chipLav: { backgroundColor: colors.accent, borderColor: colors.accent },
  routine: {
    backgroundColor: colors.canvas,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 4,
  },
  tick: { position: "absolute", width: 18, height: 18, borderColor: colors.primary },
  tickTL: { top: 16, left: 22, borderTopWidth: 2, borderLeftWidth: 2, borderTopLeftRadius: 6 },
  tickTR: { top: 16, right: 22, borderTopWidth: 2, borderRightWidth: 2, borderTopRightRadius: 6 },
  tickBL: { bottom: 16, left: 22, borderBottomWidth: 2, borderLeftWidth: 2, borderBottomLeftRadius: 6 },
  tickBR: {
    bottom: 16,
    right: 22,
    borderBottomWidth: 2,
    borderRightWidth: 2,
    borderBottomRightRadius: 6,
  },
});
