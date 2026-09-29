/** One calm, dismissible suggestion driven by recent routine behavior. */
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Pressable, View } from "react-native";

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

  const [applying, setApplying] = useState(false);
  const [saveError, setSaveError] = useState(false);

  const accept = async () => {
    if (applying) return;
    setApplying(true);
    setSaveError(false);
    const revision = {
      kind: adjustment.kind,
      acceptedAt: new Date().toISOString(),
      effectiveDate: today,
      ...(adjustment.period ? { period: adjustment.period } : {}),
      reason: adjustment.body,
    };
    const revisedRoutine = routineFor(data, revision, today).routine;
    // Wait for the write: navigating to a routine that was never saved would
    // show a change the next launch silently reverts.
    const persisted = await acceptRevision(revision, revisedRoutine);
    setApplying(false);
    if (!persisted) {
      setSaveError(true);
      AccessibilityInfo.announceForAccessibility(
        "Pore couldn’t save this change. Try again.",
      );
      return;
    }
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
        {saveError ? (
          <AppText
            variant="caption"
            color={colors.textPrimary}
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
          >
            Pore couldn’t save this change. Try again.
          </AppText>
        ) : null}
        {adjustment.cta && adjustment.href ? (
          <TextButton
            label={applying ? "Saving…" : adjustment.cta}
            onPress={() => void accept()}
          />
        ) : null}
      </Callout>
      <Pressable
        onPress={dismiss}
        accessibilityRole="button"
        accessibilityLabel="Dismiss suggestion for today"
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          // A real 44pt target, not hitSlop: the visible control is the target.
          minWidth: 44,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Ionicons name="close" size={18} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}
