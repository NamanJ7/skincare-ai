import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { Pressable, View } from "react-native";

import { contactSupport } from "@/lib/contact";
import { closeTo } from "@/lib/nav";
import { PRIVACY_ROUTE, SUPPORT_EMAIL, TERMS_ROUTE } from "@/lib/legal";
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

export default function HelpScreen() {
  const colors = useThemeColors();
  const close = () => closeTo();

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
          <AppText variant="titleSans">Help & education</AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            Clear answers about scans, routines, and safety.
          </AppText>
        </View>
        <Pressable
          onPress={close}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close help"
        >
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      <SectionHeader title="Learn" />
      <Card style={{ gap: 0, paddingVertical: spacing.xs }}>
        <ListRow
          icon="play-circle-outline"
          label="Replay the Pore promise"
          detail="A quick visual guide to photos, safety, and routines"
          onPress={() => router.push("/onboarding/intro?replay=1")}
        />
        <Divider />
        <ListRow
          icon="scan-outline"
          label="Guided scan basics"
          detail="Lighting, position, angles, and current limitations"
          onPress={() => router.push("/(tabs)/scan")}
        />
        <Divider />
        <ListRow
          icon="shield-checkmark-outline"
          label="Photo & privacy controls"
          detail="Review consent and saved-photo choices"
          onPress={() => router.push("/privacy-controls")}
        />
      </Card>

      <SectionHeader title="What to expect" />
      <View style={{ gap: spacing.sm }}>
        <Callout tone="info" title="A scan is cosmetic guidance">
          <AppText variant="caption" color={colors.textPrimary}>
            Pore can describe implemented appearance patterns when photo quality
            and analysis succeed. It cannot diagnose a condition or determine
            what caused a visible change.
          </AppText>
        </Callout>
        <Callout tone="info" title="Progress needs consistency">
          <AppText variant="caption" color={colors.textPrimary}>
            Skin varies day to day. Follow a tolerable routine, check in weekly,
            and use similar lighting and angles for comparison photos.
          </AppText>
        </Callout>
        <Callout tone="caution" title="Stop and get help when needed">
          <AppText variant="caption" color={colors.textPrimary}>
            Stop a product that causes significant irritation. Painful, severe,
            spreading, infected-looking, or persistent symptoms should be
            evaluated by a qualified healthcare professional.
          </AppText>
        </Callout>
      </View>

      <SectionHeader title="Contact" />
      <Card style={{ gap: 0, paddingVertical: spacing.xs }}>
        <ListRow
          icon="mail-outline"
          label="Contact Pore"
          detail={SUPPORT_EMAIL}
          onPress={() => void contactSupport()}
        />
        <Divider />
        <ListRow
          icon="chatbubble-ellipses-outline"
          label="Send feedback"
          detail="Report a problem or suggest an improvement"
          onPress={() => router.push("/feedback")}
        />
      </Card>

      <SectionHeader title="Legal" />
      <Card style={{ gap: 0, paddingVertical: spacing.xs }}>
        <ListRow
          icon="document-text-outline"
          label="Privacy Notice"
          detail="What Pore collects, why, and how to remove it"
          onPress={() => router.push(PRIVACY_ROUTE)}
        />
        <Divider />
        <ListRow
          icon="reader-outline"
          label="Terms of Use"
          detail="Cosmetic guidance and responsible-use terms"
          onPress={() => router.push(TERMS_ROUTE)}
        />
      </Card>
    </Screen>
  );
}
