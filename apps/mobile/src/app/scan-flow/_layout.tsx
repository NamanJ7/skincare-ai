import { Stack } from "expo-router";

import { useThemeColors } from "@/theme";

export default function ScanFlowLayout() {
  const colors = useThemeColors();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
