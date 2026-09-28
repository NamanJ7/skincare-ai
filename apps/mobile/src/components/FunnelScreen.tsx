/**
 * The one funnel-step frame — onboarding questions and check-in steps share
 * this skeleton (progress indicator, eyebrow, title/subtitle, content, footer)
 * instead of each screen hand-assembling it. The footer renders the single
 * pill CTA plus an optional borderless TextButton — never two pills.
 */
import { useEffect, type ReactNode } from "react";
import { View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import {
  AppText,
  PrimaryButton,
  ProgressBar,
  ProgressDots,
  Screen,
  TextButton,
  spacing,
  useThemeColors,
} from "@/theme";

export function FunnelScreen({
  progress,
  dots,
  eyebrow,
  title,
  subtitle,
  titleVariant = "title",
  children,
  primaryLabel,
  onPrimary,
  primaryDisabled = false,
  primaryLoading = false,
  secondaryLabel,
  onSecondary,
  footnote,
  scroll = true,
}: {
  /** Onboarding funnel bar; `from` is the previous step's fill so the bar animates in (see lib/funnel-progress). */
  progress?: { step: number; total: number; from?: number };
  /** Check-in / capture pager dots. */
  dots?: { count: number; index: number };
  /** Uppercase kicker above the title ("WEEKLY CHECK-IN"). */
  eyebrow?: string;
  title: string;
  subtitle?: string;
  /** Serif "title" for the branded onboarding funnel; "titleSans" for recurring flows. */
  titleVariant?: "title" | "titleSans";
  children?: ReactNode;
  primaryLabel: string;
  onPrimary?: () => void;
  primaryDisabled?: boolean;
  primaryLoading?: boolean;
  /** Renders as a borderless TextButton — Back / Skip / Not now. */
  secondaryLabel?: string;
  onSecondary?: () => void;
  /** Centered caption under the footer buttons. */
  footnote?: string;
  scroll?: boolean;
}) {
  const colors = useThemeColors();
  const entrance = useSharedValue(0);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    entrance.value = reduceMotion
      ? 1
      : withTiming(1, {
          duration: 380,
          easing: Easing.out(Easing.cubic),
        });
  }, [entrance, reduceMotion]);
  const entranceStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ translateY: (1 - entrance.value) * 12 }],
  }));

  return (
    <Screen scroll={scroll} contentStyle={{ paddingTop: spacing.md }}>
      {progress ? (
        <ProgressBar value={progress.step / progress.total} from={progress.from} />
      ) : null}
      {dots ? <ProgressDots count={dots.count} index={dots.index} /> : null}

      <Animated.View style={[{ gap: spacing.md }, entranceStyle]}>
        <View style={{ gap: spacing.xs, marginTop: spacing.md }}>
          {eyebrow ? (
            <AppText variant="overline" color={colors.actionPrimary}>
              {eyebrow.toUpperCase()}
            </AppText>
          ) : null}
          <AppText variant={titleVariant}>{title}</AppText>
          {subtitle ? (
            <AppText variant="body" color={colors.textSecondary}>
              {subtitle}
            </AppText>
          ) : null}
        </View>

        {children}

        <View style={{ gap: spacing.xs, marginTop: spacing.lg }}>
          <PrimaryButton
            label={primaryLabel}
            onPress={onPrimary}
            disabled={primaryDisabled}
            loading={primaryLoading}
          />
          {secondaryLabel ? (
            <TextButton label={secondaryLabel} onPress={onSecondary} />
          ) : null}
          {footnote ? (
            <AppText
              variant="caption"
              color={colors.textSecondary}
              style={{ textAlign: "center" }}
            >
              {footnote}
            </AppText>
          ) : null}
        </View>
      </Animated.View>
    </Screen>
  );
}
