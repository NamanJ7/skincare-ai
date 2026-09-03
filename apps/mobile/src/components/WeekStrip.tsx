/**
 * The week at a glance — seven marks, one per day of the current ramp week.
 *
 * A filled mark is a day with a strong active on it; a hollow one is a rest
 * day. Seeing that the rest days are *placed*, not missing, is the whole point:
 * it turns "am I doing enough?" into "tonight is handled".
 *
 * Two things this must not do. It must not read as a habit tracker — filled
 * dots mean "the plan asks for an active", not "you did it" — so the key below
 * says so in words, and days the user actually finished carry a separate tick
 * underneath. And it must not rely on fill alone, which a screen reader and a
 * colourblind user both miss, so every day is individually labelled.
 */
import { View } from "react-native";
import type { WeekPlan } from "@pore/shared";
import { AppText, colors, radius, spacing } from "@/theme";

const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

const DOT = 10;
const TICK = { width: 16, height: 2 };

export function WeekStrip({
  week,
  today,
  completed = [],
}: {
  week: WeekPlan;
  today: string;
  /** `"YYYY-MM-DD:AM"` keys for sessions finished end to end. */
  completed?: string[];
}) {
  const doneDays = new Set(completed.map((k) => k.split(":")[0]));

  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label" color={colors.inkMuted}>
        {`WEEK ${week.rampWeek} OF ${week.rampWeeks}`}
      </AppText>

      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {week.days.map((day) => {
          const isToday = day.date === today;
          const active = day.anchor !== undefined;
          const done = doneDays.has(day.date);
          return (
            <View
              key={day.date}
              accessible
              accessibilityLabel={[
                LETTERS[new Date(`${day.date}T00:00:00Z`).getUTCDay()],
                isToday ? "today," : "",
                active ? "active night" : "rest night",
                done ? ", finished" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ alignItems: "center", gap: spacing.xs }}
            >
              <AppText variant="caption" color={isToday ? colors.ink : colors.inkMuted}>
                {LETTERS[new Date(`${day.date}T00:00:00Z`).getUTCDay()]}
              </AppText>
              <View
                style={{
                  width: DOT,
                  height: DOT,
                  borderRadius: radius.pill,
                  backgroundColor: active ? colors.primary : "transparent",
                  borderWidth: active ? 0 : 1.5,
                  borderColor: colors.hairline,
                }}
              />
              {/* Two marks, deliberately different: a gold hairline under today
                  (quieter than a badge) and a green one under a day the user
                  actually finished. Without the second, the filled dots above
                  read as completion, which is the opposite of what they mean. */}
              <View
                style={{
                  ...TICK,
                  borderRadius: radius.pill,
                  backgroundColor: isToday
                    ? colors.gold
                    : done
                      ? colors.improving
                      : "transparent",
                }}
              />
            </View>
          );
        })}
      </View>

      <AppText variant="caption" color={colors.inkMuted}>
        Filled means an active is scheduled that day. Hollow is a rest day — that is the plan, not
        a gap.
      </AppText>
    </View>
  );
}
