import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";

import type { ThemeColors } from "@pore/shared";
import { track } from "@/lib/analytics";
import type { DateKey, RoutinePeriod, RoutineReactionKind } from "@/lib/log";
import { useRoutineLog } from "@/state/routine-log";
import {
  AppText,
  Callout,
  TextButton,
  radius,
  spacing,
  touchTarget,
  useThemeColors,
} from "@/theme";

const REACTIONS: readonly {
  kind: RoutineReactionKind;
  label: string;
}[] = [
  { kind: "comfortable", label: "Comfortable" },
  { kind: "tight_dry", label: "A little tight or dry" },
  {
    kind: "mild_irritation",
    label: "Mild stinging, redness, or itching",
  },
  {
    kind: "serious_reaction",
    label: "Burning, pain, or a spreading rash",
  },
];

export function routineReactionLabel(kind: RoutineReactionKind): string {
  return REACTIONS.find((item) => item.kind === kind)?.label ?? kind;
}

export function RoutineReactionSheet({
  visible,
  date,
  period,
  source,
  onClose,
}: {
  visible: boolean;
  date: DateKey;
  period: RoutinePeriod;
  source: "guided" | "quick";
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { recordReaction, dismissReaction } = useRoutineLog();
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const shown = useRef(false);

  useEffect(() => {
    if (!visible) {
      shown.current = false;
      setSaveError(false);
      return;
    }
    if (shown.current) return;
    shown.current = true;
    track("routine_reaction_prompted", { period, source });
  }, [period, source, visible]);

  async function choose(kind: RoutineReactionKind) {
    if (saving) return;
    setSaving(true);
    setSaveError(false);
    const persisted = await recordReaction(date, period, kind);
    if (!persisted) {
      setSaving(false);
      setSaveError(true);
      return;
    }
    track("routine_reaction_submitted", { period, source });
    setSaving(false);
    onClose();
  }

  async function dismiss() {
    if (saving) return;
    setSaving(true);
    setSaveError(false);
    const persisted = await dismissReaction(date, period);
    if (!persisted) {
      setSaving(false);
      setSaveError(true);
      return;
    }
    track("routine_reaction_skipped", { period, source });
    setSaving(false);
    onClose();
  }

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={() => void dismiss()}
    >
      <Pressable style={styles.scrim} onPress={() => void dismiss()}>
        <Pressable
          accessibilityViewIsModal
          style={styles.sheet}
          onPress={(event) => event.stopPropagation()}
        >
          <View style={styles.heading}>
            <AppText variant="headline">
              How did your skin feel after this routine?
            </AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              Choose the option that best matches your self-reported experience.
              Pore is not detecting a condition.
            </AppText>
          </View>

          {saveError ? (
            <View accessibilityRole="alert" accessibilityLiveRegion="assertive">
              <Callout
                tone="caution"
                title="Pore couldn’t save this change. Try again."
              />
            </View>
          ) : null}

          <View style={styles.options}>
            {REACTIONS.map((item) => (
              <Pressable
                key={item.kind}
                accessibilityRole="button"
                accessibilityLabel={item.label}
                disabled={saving}
                onPress={() => void choose(item.kind)}
                style={({ pressed }) => [
                  styles.option,
                  pressed && styles.optionPressed,
                  saving && styles.disabled,
                ]}
              >
                <AppText variant="bodyStrong" style={styles.optionLabel}>
                  {item.label}
                </AppText>
                <Ionicons
                  name="chevron-forward"
                  size={18}
                  color={colors.textSecondary}
                />
              </Pressable>
            ))}
          </View>

          <TextButton label={saving ? "Saving…" : "Skip"} onPress={dismiss} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    scrim: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: colors.overlay,
    },
    sheet: {
      gap: spacing.md,
      padding: spacing.lg,
      paddingBottom: spacing.xl,
      borderTopLeftRadius: radius.xl,
      borderTopRightRadius: radius.xl,
      backgroundColor: colors.surface,
    },
    heading: { gap: spacing.xs },
    options: { gap: spacing.xs },
    option: {
      minHeight: touchTarget.min,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.md,
      backgroundColor: colors.background,
    },
    optionLabel: { flex: 1 },
    optionPressed: { opacity: 0.75 },
    disabled: { opacity: 0.55 },
  });
}
