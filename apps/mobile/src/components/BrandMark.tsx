/** The official Pore droplet and profile mark, sized by its square frame. */
import { Image, type ImageStyle, type StyleProp } from "react-native";

const PORE_LOGO = require("../../assets/images/pore-logo.png");

export function BrandMark({ size = 64, style }: { size?: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={PORE_LOGO}
      resizeMode="contain"
      style={[{ width: size, height: size }, style]}
      accessibilityIgnoresInvertColors
      accessibilityLabel="Pore logo"
    />
  );
}
