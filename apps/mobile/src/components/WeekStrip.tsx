/**
 * The week at a glance, and the way you move around it.
 *
 * A filled mark is a day with a strong active on it; a hollow one is a rest
 * day. Seeing that the rest days are *placed*, not missing, is the whole point:
 * it turns "am I doing enough?" into "tonight is handled".
 *
 * The days are also the navigation. `planWeek` already computes a full DayPlan
 * for all seven, and that data used to be rendered as seven dots you could not
 * touch while the AM/PM switch sat at the bottom of the screen behind a full
 * scroll. Tapping a day shows it; tapping the day already selected flips
 * morning/evening.
 *
 * On touch targets: seven columns across a phone cannot each be 44pt wide — on
 * a 320pt screen the row has about 39pt per day. The columns take the full
 * width evenly and carry vertical padding to clear 44pt in height, which is the
 * standard treatment for a calendar strip and the best available here. The
 * per-day accessibility label carries the whole story so the strip is usable
 * without hitting a small target at all.
 */
import { Pressable, View } from "react-native";
import type { DayPlan, WeekPlan } from "@pore/shared";
import { AppText, colors, radius, spacing } from "@/theme";

const LETTERS = ["S", "M", "T", "W", "T", "F", "S"];
const FULL_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function weekdayIndex(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** "Thursday, retinoid night" — the strip read aloud, not just seen. */
function dayLabel(day: DayPlan, isToday: boolean): string {
  const name = isToday ? "Today" : (FULL_DAYS[weekdayIndex(day.date)] ?? day.date);
  return `${name}, ${day.pm.headline.toLowerCase()}`;
}

export function WeekStrip({
  week,
  today,
  selected,
  onSelectDay,
}: {
  week: WeekPlan;
  today: string;
  /** The day currently being shown. Usually today. */
  selected: string;
  onSelectDay: (date: string) => void;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <AppText variant="label" color={colors.inkMuted}>
        {`WEEK ${week.rampWeek} OF ${week.rampWeeks}`}
      </AppText>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {week.days.map((day) => {
          const isToday = day.date === today;
          const isSelected = day.date === selected;
          const active = day.anchor !== undefined;
          return (
            <Pressable
              key={day.date}
              onPress={() => onSelectDay(day.date)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              aria-selected={isSelected}
              accessibilityLabel={dayLabel(day, isToday)}
              style={({ pressed }) => [
                {
                  flex: 1,
                  alignItems: "center",
                  gap: spacing.xs,
                  paddingVertical: spacing.xs,
                  borderRadius: radius.md,
                  backgroundColor: isSelected ? colors.accent : "transparent",
                },
                pressed && { opacity: 0.6 },
              ]}
            >
              <AppText variant="caption" color={isToday ? colors.ink : colors.inkMuted}>
                {LETTERS[weekdayIndex(day.date)]}
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
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
