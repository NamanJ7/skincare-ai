/**
 * The calm completion moment. On the true incomplete → complete transition
 * (`celebrate`), a gentle celebrating mascot beat replaces the static check;
 * on a routine that was already complete when opened, it stays a quiet check.
 * Still no confetti — the reward is warmth, not noise. `streak` adds one honest
 * consistency line when there's a real run to name.
 */
import { View } from "react-native";

import { MascotCompanion } from "@/components/mascot/MascotCompanion";
import { AppText, StepCircle, spacing, useThemeColors } from "@/theme";

export function RoutineComplete({
  body,
  celebrate = false,
  streak = 0,
}: {
  /** Optional second line, e.g. "Tonight keeps your week on track." */
  body?: string;
  /** True only when this render IS the completing moment. */
  celebrate?: boolean;
  /** Consecutive completed days; a line is shown only for a real run (≥2). */
  streak?: number;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={{
        alignItems: "center",
        gap: spacing.xs,
        paddingVertical: spacing.sm,
      }}
    >
      {celebrate ? (
        <MascotCompanion
          state="celebrating"
          size="md"
          accessibilityLabel="Pore companion celebrating your completed routine"
        />
      ) : (
        <StepCircle state="done" size={34} />
      )}
      <AppText
        variant="bodyStrong"
        color={colors.actionPrimary}
        style={{ textAlign: "center" }}
      >
        Routine complete for now.
      </AppText>
      {streak >= 2 ? (
        <AppText
          variant="caption"
          color={colors.textSecondary}
          style={{ textAlign: "center" }}
        >
          {streak} days in a row. Consistency is the part that matters.
        </AppText>
      ) : null}
      {body ? (
        <AppText
          variant="caption"
          color={colors.textSecondary}
          style={{ textAlign: "center" }}
        >
          {body}
        </AppText>
      ) : null}
    </View>
  );
}
