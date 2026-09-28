import { type StyleProp, type TextStyle } from "react-native";

import { AppText, useThemeColors } from "@/theme";

export function Disclaimer({ style }: { style?: StyleProp<TextStyle> }) {
  const colors = useThemeColors();
  return (
    <AppText
      variant="caption"
      color={colors.textSecondary}
      style={[{ textAlign: "center" }, style]}
    >
      Cosmetic guidance, not medical advice.
    </AppText>
  );
}
