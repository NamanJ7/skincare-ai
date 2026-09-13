/**
 * Edit profile (modal) — change any questionnaire answer without starting
 * over. Rows reuse the onboarding screens in `?edit=1` save-and-return mode.
 * The bottom hint is honest about what an edit does: an answers-only routine
 * re-adjusts automatically, but a scan-built plan stays as-is until re-scan.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { scanAccess } from "@/lib/gate";
import { closeTo, scanEntryHref } from "@/lib/nav";
import { answerRows, editHint } from "@/lib/profile-rows";
import { useEntitlement } from "@/state/entitlement";
import { useOnboarding } from "@/state/onboarding";
import { useScanHistory } from "@/state/scan-history";
import {
  AppText,
  Callout,
  Card,
  Divider,
  ListRow,
  Screen,
  TextButton,
  spacing,
  useThemeColors,
} from "@/theme";

export default function EditProfile() {
  const colors = useThemeColors();
  const { data } = useOnboarding();
  const { entitlement } = useEntitlement();
  const { history } = useScanHistory();
  const hint = editHint(data);
  const access = scanAccess(entitlement, data, history);
  const rescanHref = access.allowed
    ? scanEntryHref(data, "rescan")
    : access.reason === "plus_required"
      ? "/paywall?feature=rescan"
      : "/(tabs)/scan";

  return (
    <Screen contentStyle={{ paddingTop: spacing.lg }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <AppText variant="titleSans">Edit profile</AppText>
        <Pressable
          onPress={() => closeTo()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close edit profile"
        >
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>
      <AppText variant="caption" color={colors.textSecondary}>
        Change any answer.
      </AppText>

      <Card style={{ gap: 0, paddingVertical: spacing.xs }}>
        {answerRows(data).map((row, i) => (
          <View key={row.screen}>
            {i > 0 ? <Divider /> : null}
            <ListRow
              label={row.label}
              detail={row.value}
              onPress={() => router.push(`/onboarding/${row.screen}?edit=1`)}
            />
          </View>
        ))}
      </Card>

      <Callout tone="info" icon="refresh-outline">
        <AppText variant="caption" color={colors.info}>
          {hint.text}
        </AppText>
        {hint.rescan ? (
          <View style={{ alignItems: "flex-start" }}>
            <TextButton
              label={
                access.reason === "cadence_wait"
                  ? `Next scan in ${access.daysUntilAvailable} ${access.daysUntilAvailable === 1 ? "day" : "days"}`
                  : "Re-scan"
              }
              onPress={() => router.push(rescanHref)}
            />
          </View>
        ) : null}
      </Callout>
    </Screen>
  );
}
