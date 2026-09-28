import { Stack } from "expo-router";

import { useThemeColors } from "@/theme";

export default function CheckInLayout() {
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
