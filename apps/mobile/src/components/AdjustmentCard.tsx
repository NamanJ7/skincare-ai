/** One calm, dismissible suggestion driven by recent routine behavior. */
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useRef } from "react";
import { Pressable, View } from "react-native";

import { track } from "@/lib/analytics";
import type { RoutineAdjustment } from "@/lib/adjustments";
import { routineFor } from "@/lib/plan";
import { useReminders } from "@/state/reminders";
import { useRoutineLog } from "@/state/routine-log";
import { useOnboarding } from "@/state/onboarding";
import { AppText, Callout, TextButton, spacing, useThemeColors } from "@/theme";

export function AdjustmentCard({
  adjustment,
  today,
}: {
  adjustment: RoutineAdjustment;
  today: string;
}) {
  const colors = useThemeColors();
  const { dismissAdjustment } = useReminders();
  const { acceptRevision } = useRoutineLog();
  const { data } = useOnboarding();
  const shownKind = useRef<RoutineAdjustment["kind"] | undefined>(undefined);

  useEffect(() => {
    if (shownKind.current === adjustment.kind) return;
    shownKind.current = adjustment.kind;
    track("routine_adjustment_shown", { kind: adjustment.kind });
  }, [adjustment.kind]);

  const accept = () => {
    const revision = {
      kind: adjustment.kind,
      acceptedAt: new Date().toISOString(),
      effectiveDate: today,
      ...(adjustment.period ? { period: adjustment.period } : {}),
      reason: adjustment.body,
    };
    const revisedRoutine = routineFor(data, revision, today).routine;
    acceptRevision(revision, revisedRoutine);
    // Accepted suggestions should not immediately reappear on Home.
    dismissAdjustment(adjustment.kind, today);
    track("routine_adjustment_accepted", { kind: adjustment.kind });
    if (adjustment.href) router.push(adjustment.href);
  };

  const dismiss = () => {
    dismissAdjustment(adjustment.kind, today);
    track("routine_adjustment_dismissed", { kind: adjustment.kind });
  };

  return (
    <View>
      <Callout
        tone="info"
        title={adjustment.headline}
        style={{ paddingRight: spacing.xl }}
      >
        <AppText variant="body" color={colors.textPrimary}>
          {adjustment.body}
        </AppText>
        {adjustment.cta && adjustment.href ? (
          <TextButton label={adjustment.cta} onPress={accept} />
        ) : null}
      </Callout>
      <Pressable
        onPress={dismiss}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Dismiss suggestion for today"
        style={{
          position: "absolute",
          right: spacing.sm,
          top: spacing.sm,
          padding: spacing.xs,
        }}
      >
        <Ionicons name="close" size={18} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}
