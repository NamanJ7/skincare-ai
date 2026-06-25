/**
 * Pore brand mark — a stylized water-drop with a sparkle, drawn with plain Views
 * (no SVG dep). A faithful stand-in for the logo until the real artwork is
 * dropped in as an asset. Sized by `size` (the drop's bounding box).
 */
import { View } from "react-native";
import { colors } from "@/theme";

export function BrandMark({ size = 64, color = colors.primary }: { size?: number; color?: string }) {
  const sparkle = Math.max(8, size * 0.15);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      {/* Water droplet: a square with three rounded corners + one soft point.
          Rotated 45° so the point sits at the top, like a falling drop. */}
      <View
        style={{
          width: size * 0.74,
          height: size * 0.74,
          borderWidth: 2,
          borderColor: color,
          backgroundColor: "transparent",
          borderTopLeftRadius: size * 0.07,
          borderTopRightRadius: size * 0.42,
          borderBottomRightRadius: size * 0.42,
          borderBottomLeftRadius: size * 0.42,
          transform: [{ rotate: "45deg" }],
        }}
      />
      {/* Four-point sparkle (a rotated square) in antique gold, in the bulb. */}
      <View
        style={{
          position: "absolute",
          width: sparkle,
          height: sparkle,
          left: size * 0.3,
          top: size * 0.42,
          backgroundColor: colors.gold,
          borderRadius: sparkle * 0.18,
          transform: [{ rotate: "45deg" }],
        }}
      />
    </View>
  );
}
