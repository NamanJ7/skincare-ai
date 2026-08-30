/**
 * The guided-capture overlay: a dimmed scrim with an oval cut-out, one
 * instruction, and the inline feedback the gate produces.
 *
 * The cut-out is a plain View with an oversized border rather than an SVG mask.
 * RN draws borders inside the element bounds, so an element sized
 * (oval + 2 * border) with that border painted in the scrim colour leaves the
 * oval transparent. No mask library, no native module.
 */
import { StyleSheet, View, type LayoutChangeEvent } from "react-native";
import { AppText, ProgressDots, colors, radius, spacing } from "@/theme";

const SCRIM = "rgba(28,28,26,0.62)";
/** Large enough to cover any phone once the oval is centred. */
const BLEED = 900;

export function CaptureFrame({
  title,
  hint,
  error,
  stepIndex,
  stepCount,
  onLayout,
}: {
  title: string;
  hint: string;
  /** Set when the gate rejected the last frame — one specific, fixable instruction. */
  error?: string | null;
  stepIndex: number;
  stepCount: number;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" onLayout={onLayout}>
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <View
          style={{
            width: OVAL_W + BLEED * 2,
            height: OVAL_H + BLEED * 2,
            borderWidth: BLEED,
            borderColor: SCRIM,
            // A capsule, not a true ellipse — RN cannot draw one without a mask
            // library, and a capsule reads correctly as a face guide.
            borderRadius: (OVAL_W + BLEED * 2) / 2,
          }}
        />
        <View
          style={{
            position: "absolute",
            width: OVAL_W,
            height: OVAL_H,
            borderRadius: OVAL_W / 2,
            borderWidth: 2,
            borderColor: error ? colors.escalate : "rgba(255,255,255,0.85)",
          }}
        />
      </View>

      <View
        style={{
          position: "absolute",
          top: spacing.xxl,
          left: spacing.lg,
          right: spacing.lg,
          alignItems: "center",
          gap: spacing.xs,
        }}
      >
        <ProgressDots count={stepCount} index={stepIndex} />
        <AppText variant="heading" color={colors.onPrimary} style={{ textAlign: "center" }}>
          {title}
        </AppText>
        <AppText variant="caption" color="rgba(255,255,255,0.8)" style={{ textAlign: "center" }}>
          {hint}
        </AppText>
      </View>

      {error ? (
        <View
          style={{
            position: "absolute",
            bottom: 140,
            left: spacing.lg,
            right: spacing.lg,
            backgroundColor: colors.escalate,
            borderRadius: radius.pill,
            paddingVertical: spacing.sm,
            paddingHorizontal: spacing.md,
          }}
        >
          <AppText variant="bodyStrong" color={colors.onPrimary} style={{ textAlign: "center" }}>
            {error}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

/** Oval geometry, in points. Sized so a face at arm's length fills it. */
const OVAL_W = 260;
const OVAL_H = 340;
