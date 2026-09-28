import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { hasCurrentPhotoAnalysisConsent } from "@/lib/consent";
import { confirm } from "@/lib/dialogs";
import { closeTo } from "@/lib/nav";
import { PRIVACY_ROUTE } from "@/lib/legal";
import { photoPrivacyLine } from "@/lib/analysis-status";
import { useOnboarding } from "@/state/onboarding";
import { useScanHistory } from "@/state/scan-history";
import {
  AppText,
  Callout,
  Card,
  Divider,
  ListRow,
  Screen,
  SectionHeader,
  spacing,
  useThemeColors,
} from "@/theme";

export default function PrivacyControlsScreen() {
  const colors = useThemeColors();
  const { data, update } = useOnboarding();
  const { history } = useScanHistory();
  const consent = data.photoAnalysisConsent;
  const active = hasCurrentPhotoAnalysisConsent(consent);

  const close = () => closeTo();

  const withdraw = async () => {
    if (!active || !consent) return;
    const confirmed = await confirm({
      title: "Turn off future photo analysis?",
      message:
        "Pore will ask for permission again before a future scan. This does not delete saved photos or your existing plan.",
      confirmLabel: "Turn off",
      destructive: true,
    });
    if (!confirmed) return;
    update({
      photoAnalysisConsent: {
        ...consent,
        withdrawnAt: new Date().toISOString(),
      },
    });
  };

  return (
    <Screen contentStyle={{ paddingTop: spacing.lg }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <AppText variant="titleSans">Photo & privacy</AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            Control future processing and review what is saved.
          </AppText>
        </View>
        <Pressable
          onPress={close}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close photo and privacy controls"
        >
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      <Callout
        tone={active ? "success" : "info"}
        title={
          active
            ? "Photo analysis permission is active"
            : "Photo analysis permission is off"
        }
      >
        <AppText variant="caption" color={colors.textPrimary}>
          {active
            ? "Pore still asks you to confirm the disclosure each time you enter a new scan."
            : "Your answers-only routine remains available. A future scan will show the full disclosure before asking again."}
        </AppText>
      </Callout>

      <AppText variant="caption" color={colors.textSecondary}>
        {photoPrivacyLine()}
      </AppText>

      <SectionHeader title="Controls" />
      <Card style={{ gap: 0, paddingVertical: spacing.xs }}>
        {active ? (
          <>
            <ListRow
              icon="hand-left-outline"
              label="Turn off future photo analysis"
              detail="Pore will ask before any later scan"
              onPress={() => void withdraw()}
              tone={colors.error}
            />
            <Divider />
          </>
        ) : null}
        <ListRow
          icon="images-outline"
          label="Review saved scan photos"
          detail={`${history.scans.length} saved ${history.scans.length === 1 ? "scan" : "scans"} · select a scan in Progress to delete it`}
          onPress={() => router.push("/(tabs)/progress")}
        />
        <Divider />
        <ListRow
          icon="document-text-outline"
          label="Read the Privacy Notice"
          detail="Photo processing, storage, and youth privacy"
          onPress={() => router.push(PRIVACY_ROUTE)}
        />
      </Card>

      <Callout tone="info" title="Deleting photos">
        <AppText variant="caption" color={colors.textPrimary}>
          Saved guided scans can be selected and deleted from Progress. “Delete
          my data” in Profile removes every locally saved photo, including
          optional check-in photos, along with the rest of your Pore data. If
          you have an account, “Delete my account” also permanently removes
          your account and everything stored for it on Pore’s servers.
        </AppText>
      </Callout>
    </Screen>
  );
}
