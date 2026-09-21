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

/** "Thursday, retinoid night, done" — the strip read aloud, not just seen. */
function dayLabel(day: DayPlan, isToday: boolean, done: boolean): string {
  const name = isToday ? "Today" : (FULL_DAYS[weekdayIndex(day.date)] ?? day.date);
  return `${name}, ${day.pm.headline.toLowerCase()}${done ? ", done" : ""}`;
}

export function WeekStrip({
  week,
  today,
  selected,
  finished,
  onSelectDay,
}: {
  week: WeekPlan;
  today: string;
  /** The day currently being shown. Usually today. */
  selected: string;
  /**
   * Session keys (`"YYYY-MM-DD:PM"`) the user actually completed.
   *
   * The strip used to render only the plan, which meant the one surface a
   * returning user looks at every single day could not show them a single thing
   * they had done. The journal held every tick-off the whole time; nothing read
   * it back. Forty-one days of identical screens is what that looks like from
   * the outside.
   */
  finished: string[];
  onSelectDay: (date: string) => void;
}) {
  const doneDays = new Set(finished.map((key) => key.split(":")[0]));
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
          /*
           * Orthogonal to `active`, and deliberately so: "was there a strong
           * active on this day" and "did you do it" are different facts, and
           * collapsing them would make a completed rest day indistinguishable
           * from a missed treatment night.
           */
          const done = doneDays.has(day.date);
          return (
            <Pressable
              key={day.date}
              onPress={() => onSelectDay(day.date)}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              aria-selected={isSelected}
              accessibilityLabel={dayLabel(day, isToday, done)}
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
              {/*
                A ring around the dot for a day that was finished. Nothing marks
                a day that was not — the deload engine exists to tell people to
                stop when their skin says stop, and a screen that scored them for
                stopping would be arguing with it. There is a mark for showing
                up and no mark for anything else.
              */}
              <View
                style={{
                  width: 20,
                  height: 20,
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: radius.pill,
                  borderWidth: done ? 1.5 : 0,
                  borderColor: colors.primary,
                }}
              >
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
              </View>
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
