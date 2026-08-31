/**
 * Today — the one screen that answers one question: what do I do right now?
 *
 * Everything else in the product (the assessment, the frequencies, the safety
 * adjustments) is a reference document; it lives on /plan. This screen shows
 * only the three or four things standing between the user and a finished
 * session, plus the single line explaining why tonight looks the way it does.
 *
 * The cadence comes from `planDay` in @pore/shared — the same deterministic
 * treatment as the safety rules. Nothing on this screen asks the user to decide
 * anything except the one question at the end, which is what keeps the plan
 * honest week to week.
 */
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import {
  ACTIVES,
  applySafetyRules,
  currentSession,
  planDay,
  planWeek,
  today as todayDate,
  weekdayName,
  type ProductCategory,
  type Routine,
  type RoutineStep,
  type RoutineTime,
  type SkinFeel,
} from "@pore/shared";
import { CheckCircle } from "@/components/CheckCircle";
import { WeekStrip } from "@/components/WeekStrip";
import { buildIntake } from "@/lib/intake";
import {
  checkInFor,
  completedSteps,
  readJournal,
  recordCheckIn,
  streakDays,
  toggleStep,
} from "@/lib/journal";
import { useOnboarding } from "@/state/onboarding";
import {
  AppText,
  Card,
  Divider,
  GhostButton,
  Screen,
  colors,
  radius,
  spacing,
} from "@/theme";

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  cleanser: "Cleanser",
  treatment: "Treatment",
  serum: "Serum",
  moisturizer: "Moisturizer",
  sunscreen: "Sunscreen (SPF)",
  exfoliant: "Exfoliant",
  spot_treatment: "Spot treatment",
};

const FEELS: { feel: SkinFeel; label: string }[] = [
  { feel: "calm", label: "Calm" },
  { feel: "tight", label: "Tight" },
  { feel: "stinging", label: "Stinging" },
];

/** Same over-loaded draft the plan screen uses, so the engine has work to do. */
function draftRoutine(): Routine {
  const step = (
    order: number,
    category: ProductCategory,
    active: RoutineStep["active"],
    frequencyPerWeek: number,
    rationale: string,
  ): RoutineStep => ({ order, category, active, frequencyPerWeek, rationale, irritationRisk: "medium" });
  return {
    am: [
      step(1, "cleanser", undefined, 7, "Start clean without stripping your skin."),
      step(2, "serum", "vitamin_c", 7, "Brightens and helps even out tone over time."),
      step(3, "moisturizer", undefined, 7, "Locks in hydration and supports your barrier."),
    ],
    pm: [
      step(1, "cleanser", undefined, 7, "Remove the day's oil and sunscreen."),
      step(2, "exfoliant", "salicylic_acid", 4, "Helps clear pores and reduce breakouts."),
      step(3, "exfoliant", "glycolic_acid", 4, "Smooths texture and fades marks."),
      step(4, "treatment", "retinoid", 7, "Boosts cell turnover for texture and marks."),
    ],
    notes: ["Patch-test any new active for a few days before full use."],
  };
}

function stepLabel(step: RoutineStep): string {
  return step.active ? ACTIVES[step.active].short : CATEGORY_LABELS[step.category];
}

export default function Today() {
  const { data } = useOnboarding();
  const [journal, setJournal] = useState(() => readJournal());
  const [time, setTime] = useState<RoutineTime>(() => currentSession());

  const date = todayDate();
  const intake = useMemo(() => buildIntake(data), [data]);

  // Re-read on focus: the record can be erased from /plan, and a session left
  // open overnight should come back as the new day rather than yesterday's.
  useFocusEffect(
    useCallback(() => {
      setJournal(readJournal());
      setTime(currentSession());
    }, []),
  );

  // Prefer the server-generated routine; fall back to running the safety engine
  // locally so the full cadence still works offline.
  const routine = useMemo(
    () => data.plan?.routine ?? applySafetyRules(draftRoutine(), intake).routine,
    [data.plan, intake],
  );

  const ctx = useMemo(
    () => ({ startedOn: journal.startedOn, on: date, checkIns: journal.checkIns }),
    [journal.startedOn, journal.checkIns, date],
  );

  const day = useMemo(() => planDay(routine, intake, ctx), [routine, intake, ctx]);
  const week = useMemo(() => planWeek(routine, intake, ctx), [routine, intake, ctx]);

  const session = time === "AM" ? day.am : day.pm;
  const done = completedSteps(journal, date, time);
  const allDone = session.steps.length > 0 && done.length >= session.steps.length;
  const streak = streakDays(journal, date);
  const feeling = checkInFor(journal, date);

  const onToggle = useCallback(
    (order: number) => setJournal(toggleStep(date, time, order, session.steps.length)),
    [date, time, session.steps.length],
  );

  const onFeel = useCallback((feel: SkinFeel) => setJournal(recordCheckIn(date, feel)), [date]);

  return (
    <Screen contentStyle={{ paddingTop: spacing.lg }}>
      <View style={{ gap: spacing.xxs }}>
        <AppText variant="label" color={colors.primary}>
          {`${weekdayName(date).toUpperCase()} · ${time === "AM" ? "MORNING" : "EVENING"}`}
        </AppText>
        <AppText variant="title">{session.headline}</AppText>
        {streak >= 2 && (
          <AppText variant="caption" color={colors.inkMuted}>
            {`${streak} days in a row.`}
          </AppText>
        )}
      </View>

      <Card elevated>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <AppText variant="heading">{allDone ? "Done for now" : "Do this now"}</AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            {`${done.length} of ${session.steps.length}`}
          </AppText>
        </View>

        <View style={{ marginTop: spacing.xs }}>
          {session.steps.map((step, i) => {
            const checked = done.includes(step.order);
            return (
              <View key={`${step.category}-${step.order}`}>
                {i > 0 && <Divider />}
                <Pressable
                  onPress={() => onToggle(step.order)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  accessibilityLabel={`${stepLabel(step)}. ${step.rationale}`}
                  style={({ pressed }) => [
                    {
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: spacing.sm,
                      minHeight: 56,
                      paddingVertical: spacing.sm,
                    },
                    pressed && { opacity: 0.6 },
                  ]}
                >
                  <View style={{ paddingTop: 2 }}>
                    <CheckCircle checked={checked} />
                  </View>
                  <View style={{ flex: 1, gap: spacing.xxs }}>
                    <AppText
                      variant="bodyStrong"
                      color={checked ? colors.inkMuted : colors.ink}
                      style={checked ? { textDecorationLine: "line-through" } : undefined}
                    >
                      {stepLabel(step)}
                    </AppText>
                    <AppText variant="caption" color={colors.inkMuted}>
                      {step.rationale}
                    </AppText>
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      </Card>

      {session.notes.length > 0 && (
        <Card>
          <AppText variant="heading">Why tonight looks like this</AppText>
          <View style={{ gap: spacing.xs, marginTop: spacing.xxs }}>
            {session.notes.map((note, i) => (
              <AppText key={`${note.id}-${i}`} variant="caption" color={colors.ink}>
                • {note.detail}
              </AppText>
            ))}
          </View>
        </Card>
      )}

      <Card>
        <WeekStrip week={week} today={date} />
      </Card>

      {/* The single question the product asks. One tap, and it is what moves the
          ramp forward or pulls it back — so the answer is never cosmetic. */}
      {(allDone || feeling) && (
        <Card elevated>
          <AppText variant="heading">How does your skin feel?</AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            {feeling
              ? "Logged. This is what sets next week's pace — you don't have to adjust anything yourself."
              : "One tap. It changes what we ask of your skin next."}
          </AppText>
          <View style={{ flexDirection: "row", gap: spacing.xs, marginTop: spacing.xxs }}>
            {FEELS.map(({ feel, label }) => {
              const selected = feeling === feel;
              return (
                <Pressable
                  key={feel}
                  onPress={() => onFeel(feel)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`My skin feels ${label.toLowerCase()}`}
                  style={({ pressed }) => [
                    {
                      flex: 1,
                      minHeight: 48,
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: radius.pill,
                      borderWidth: 1,
                      borderColor: selected ? colors.primary : colors.hairline,
                      backgroundColor: selected ? colors.primary : colors.surface,
                    },
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <AppText variant="caption" color={selected ? colors.onPrimary : colors.ink}>
                    {label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </Card>
      )}

      <View style={{ gap: spacing.xs }}>
        <GhostButton
          label={time === "AM" ? "Show tonight instead" : "Show this morning instead"}
          onPress={() => setTime(time === "AM" ? "PM" : "AM")}
        />
        <GhostButton label="Your full plan" onPress={() => router.push("/plan")} />
      </View>
    </Screen>
  );
}
