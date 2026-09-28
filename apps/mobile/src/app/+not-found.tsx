/**
 * Unmatched route recovery.
 *
 * Without this file expo-router renders its own "Unmatched Route" screen,
 * which is a development affordance rather than something a reader following a
 * stale notification or deep link should ever see.
 */
import { router } from "expo-router";
import { View } from "react-native";

import {
  AppText,
  PrimaryButton,
  Screen,
  TextButton,
  spacing,
  useThemeColors,
} from "@/theme";

export default function NotFoundScreen() {
  const colors = useThemeColors();

  return (
    <Screen scroll={false} contentStyle={{ justifyContent: "center" }}>
      <View accessibilityRole="alert" style={{ gap: spacing.md }}>
        <AppText variant="titleSans">That screen has moved</AppText>
        <AppText color={colors.textSecondary}>
          The link you followed does not point anywhere in Pore anymore. Your
          routine, scans, and progress are all still here.
        </AppText>
        <PrimaryButton
          label="Go to Home"
          onPress={() => router.replace("/(tabs)")}
        />
        <TextButton
          label="Open Profile"
          onPress={() => router.replace("/(tabs)/profile")}
        />
      </View>
    </Screen>
  );
}
