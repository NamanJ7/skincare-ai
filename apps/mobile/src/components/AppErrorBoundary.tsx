import type { ErrorBoundaryProps } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

import { track } from "@/lib/analytics";
import { AppText, PrimaryButton, spacing, useThemeColors } from "@/theme";

/** Root-safe recovery UI. Raw service or exception messages are never shown. */
export function AppErrorBoundary({ retry }: ErrorBoundaryProps) {
  const colors = useThemeColors();
  useEffect(() => {
    track("app_error", { surface: "root" });
  }, []);

  return (
    <View
      accessibilityRole="alert"
      style={{
        flex: 1,
        justifyContent: "center",
        padding: spacing.xl,
        gap: spacing.md,
        backgroundColor: colors.background,
      }}
    >
      <AppText variant="titleSans">Pore needs a fresh start</AppText>
      <AppText color={colors.textSecondary}>
        Your saved routine and scans are still on this device. Try opening this
        screen again.
      </AppText>
      <PrimaryButton label="Try again" onPress={() => void retry()} />
    </View>
  );
}
