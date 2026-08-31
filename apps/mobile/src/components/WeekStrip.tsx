/**
 * The week at a glance — seven marks, one per day of the current ramp week.
 *
 * A filled mark is a day with a strong active on it; a hollow one is a rest
 * day. Seeing that the rest days are *placed*, not missing, is the whole point:
 * it turns "am I doing enough?" into "tonight is handled".
 */
import { View } from "react-native";
import type { WeekPlan } from "@pore/shared";
import { AppText, colors, radius, spacing } from "@/theme";

const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

export function WeekStrip({ week, today }: { week: WeekPlan; today: string }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label" color={colors.inkMuted}>
        {`WEEK ${week.rampWeek} OF ${week.rampWeeks}`}
      </AppText>
      <View
        style={{ flexDirection: "row", justifyContent: "space-between" }}
        accessible
        accessibilityLabel={`Week ${week.rampWeek} of ${week.rampWeeks}. ${
          week.days.filter((d) => d.anchor).length
        } of 7 days have a strong active.`}
      >
        {week.days.map((day) => {
          const isToday = day.date === today;
          const active = day.anchor !== undefined;
          return (
            <View key={day.date} style={{ alignItems: "center", gap: spacing.xs }}>
              <AppText variant="caption" color={isToday ? colors.ink : colors.inkMuted}>
                {LETTERS[new Date(`${day.date}T00:00:00Z`).getUTCDay()]}
              </AppText>
              <View
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: radius.pill,
                  backgroundColor: active ? colors.primary : "transparent",
                  borderWidth: active ? 0 : 1.5,
                  borderColor: colors.hairline,
                }}
              />
              {/* A hairline under today, rather than a badge — quieter, and it
                  never competes with the filled/hollow reading above it. */}
              <View
                style={{
                  height: 2,
                  width: 16,
                  borderRadius: radius.pill,
                  backgroundColor: isToday ? colors.gold : "transparent",
                }}
              />
            </View>
          );
        })}
      </View>
    </View>
  );
}
