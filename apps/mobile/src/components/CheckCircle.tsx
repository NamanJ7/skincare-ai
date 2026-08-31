/**
 * The tick on a routine step.
 *
 * The check is drawn from two rotated rules rather than a glyph or an icon
 * dependency: it stays crisp at any size, inherits the brand green exactly, and
 * costs nothing to ship. Purely decorative — the row that owns it carries the
 * accessibility role and label.
 */
import { View } from "react-native";
import { colors, radius } from "@/theme";

const SIZE = 26;

export function CheckCircle({ checked }: { checked: boolean }) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      style={{
        width: SIZE,
        height: SIZE,
        borderRadius: radius.pill,
        borderWidth: checked ? 0 : 1.5,
        borderColor: colors.hairline,
        backgroundColor: checked ? colors.primary : "transparent",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {checked && (
        <View style={{ width: 13, height: 13 }}>
          <View
            style={{
              position: "absolute",
              left: 0,
              top: 6,
              width: 6,
              height: 2,
              borderRadius: 1,
              backgroundColor: colors.onPrimary,
              transform: [{ rotate: "45deg" }],
            }}
          />
          <View
            style={{
              position: "absolute",
              left: 3,
              top: 4,
              width: 10,
              height: 2,
              borderRadius: 1,
              backgroundColor: colors.onPrimary,
              transform: [{ rotate: "-50deg" }],
            }}
          />
        </View>
      )}
    </View>
  );
}
