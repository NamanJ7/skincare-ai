/**
 * The three tab glyphs, drawn with plain Views.
 *
 * Same approach as CheckCircle and BrandMark: no icon dependency, no emoji,
 * crisp at any size, and the brand green comes from the tokens rather than
 * being baked into an asset. Each shape says what its surface is for —
 * a single mark for today's session, stacked rules for the reference document,
 * rising bars for the measurement.
 *
 * Decorative: the tab itself carries the label and the accessibility role.
 */
import { View, type ColorValue } from "react-native";
import { radius } from "@/theme";

const SIZE = 22;

export type TabIconName = "today" | "plan" | "progress";

export function TabIcon({ name, color, focused }: { name: TabIconName; color: ColorValue; focused: boolean }) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center" }}
    >
      {name === "today" && <Today color={color} focused={focused} />}
      {name === "plan" && <Plan color={color} />}
      {name === "progress" && <Progress color={color} focused={focused} />}
    </View>
  );
}

/** A ring that fills once selected — the one session in front of you. */
function Today({ color, focused }: { color: ColorValue; focused: boolean }) {
  return (
    <View
      style={{
        width: SIZE - 4,
        height: SIZE - 4,
        borderRadius: radius.pill,
        borderWidth: 2,
        borderColor: color,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {focused && (
        <View
          style={{
            width: (SIZE - 4) / 2.4,
            height: (SIZE - 4) / 2.4,
            borderRadius: radius.pill,
            backgroundColor: color,
          }}
        />
      )}
    </View>
  );
}

/** Stacked rules — the full routine as a document you can refer back to. */
function Plan({ color }: { color: ColorValue }) {
  return (
    <View style={{ width: SIZE - 4, gap: 3.5 }}>
      {[1, 0.78, 0.92].map((scale, i) => (
        <View
          key={i}
          style={{
            height: 2.5,
            width: `${scale * 100}%`,
            borderRadius: radius.pill,
            backgroundColor: color,
          }}
        />
      ))}
    </View>
  );
}

/** Rising bars — the only surface that makes a claim about change over time. */
function Progress({ color, focused }: { color: ColorValue; focused: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 3, height: SIZE - 6 }}>
      {[0.45, 0.72, 1].map((scale, i) => (
        <View
          key={i}
          style={{
            width: 4,
            height: `${scale * 100}%`,
            borderRadius: 2,
            backgroundColor: color,
            opacity: focused ? 1 : 0.85,
          }}
        />
      ))}
    </View>
  );
}
