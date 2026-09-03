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
 *
 * The routine is read from the on-device record, never reconstructed. This
 * screen used to fall back to a hardcoded demo routine when the in-memory plan
 * was missing, which after a restart was always — so the app quietly showed
 * every returning user a generic routine and called it theirs.
 */
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";

import {
  ACTIVES,
  currentSession,
  planDay,
  planWeek,
  today as todayDate,
  weekdayName,
  type ProductCategory,
  type RoutineStep,
  type RoutineTime,
  type SkinFeel,
} from "@pore/shared";
import { CheckCircle } from "@/components/CheckCircle";
import { WeekStrip } from "@/components/WeekStrip";
import { buildIntake } from "@/lib/intake";
import {
  activeRoutine,
  checkInFor,
  completedSteps,
  readJournal,
  recordCheckIn,
  streakDays,
  toggleStep,
  weeksOnRoutine,
} from "@/lib/journal";
import { listSessions } from "@/lib/photos";
import {
  AppText,
  Card,
  Divider,
  GhostButton,
  PrimaryButton,
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

/** After this long on one routine, a second photo set can actually be measured. */
const RECHECK_AFTER_WEEKS = 4;

function stepLabel(step: RoutineStep): string {
  return step.active ? ACTIVES[step.active].short : CATEGORY_LABELS[step.category];
}

export default function Today() {
  const [journal, setJournal] = useState(() => readJournal());
  const [date, setDate] = useState(() => todayDate());
  const [time, setTime] = useState<RoutineTime>(() => currentSession());
  const [sessionCount, setSessionCount] = useState(() => listSessions().length);

  // Re-read on focus: the record can be erased from /plan, and a session left
  // open overnight should come back as the new day rather than yesterday's.
  //
  // The AM/PM choice is deliberately *not* reset here. It used to be, which
  // meant a user who tapped "Show tonight instead", looked at /plan, and came
  // back was silently bounced to the morning. It only resets when the calendar
  // day actually turns over.
  useFocusEffect(
    useCallback(() => {
      setJournal(readJournal());
      setSessionCount(listSessions().length);
      const now = todayDate();
      setDate((prev) => {
        if (prev !== now) setTime(currentSession());
        return now;
      });
    }, []),
  );

  const routine = activeRoutine(journal);
  const intake = useMemo(() => buildIntake(journal.intake ?? {}), [journal.intake]);

  const ctx = useMemo(
    () => ({ startedOn: journal.startedOn, on: date, checkIns: journal.checkIns }),
    [journal.startedOn, journal.checkIns, date],
  );

  const day = useMemo(
    () => (routine ? planDay(routine, intake, ctx) : null),
    [routine, intake, ctx],
  );
  const week = useMemo(
    () => (routine ? planWeek(routine, intake, ctx) : null),
    [routine, intake, ctx],
  );

  const onToggle = useCallback(
    (order: number, total: number) => setJournal(toggleStep(date, time, order, total)),
    [date, time],
  );
  const onFeel = useCallback((feel: SkinFeel) => setJournal(recordCheckIn(date, feel)), [date]);

  // No routine means no plan was ever successfully generated. Say that, and
  // give the one action that fixes it — never a stand-in routine.
  if (!day || !week) {
    return (
      <Screen contentStyle={{ paddingTop: spacing.section }}>
        <AppText variant="label" color={colors.primary}>
          NOT SET UP YET
        </AppText>
        <AppText variant="title">You don&apos;t have a routine yet</AppText>
        <AppText variant="body" color={colors.inkMuted}>
          Three guided photos and five questions is the whole setup. Everything after that is one
          tap a day.
        </AppText>
        <View style={{ marginTop: spacing.md }}>
          <PrimaryButton
            label="Set up my routine"
            onPress={() => router.push("/onboarding/photo")}
          />
        </View>
      </Screen>
    );
  }

  const session = time === "AM" ? day.am : day.pm;
  const done = completedSteps(journal, date, time);
  const allDone = session.steps.length > 0 && done.length >= session.steps.length;
  const streak = streakDays(journal, date);
  const feeling = checkInFor(journal, date);
  // The progress engine is the point of the product, and it used to be three
  // taps deep behind a ghost button. Once a comparison is possible, offer it.
  const canCompare = sessionCount >= 2;
  const dueForRecheck =
    !canCompare && weeksOnRoutine(journal, date) >= RECHECK_AFTER_WEEKS && sessionCount >= 1;

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
                  onPress={() => onToggle(step.order, session.steps.length)}
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
        <WeekStrip week={week} today={date} completed={journal.finished} />
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

      {/* Only ever offered when a measurement is actually possible. A prompt to
          re-shoot that we then refuse to measure is just a nag. */}
      {dueForRecheck && (
        <Card elevated>
          <AppText variant="heading">
            {`${weeksOnRoutine(journal, date)} weeks in. Time to measure.`}
          </AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            One more guided set — same screen flash, same spot — and we can subtract the two and
            tell you what actually changed, instead of asking you to remember.
          </AppText>
          <PrimaryButton
            label="Take a new set"
            onPress={() => router.push("/onboarding/photo?mode=recheck")}
          />
        </Card>
      )}

      <View style={{ gap: spacing.xs }}>
        <GhostButton
          label={time === "AM" ? "Show tonight instead" : "Show this morning instead"}
          onPress={() => setTime(time === "AM" ? "PM" : "AM")}
        />
        {canCompare && (
          <GhostButton label="See what changed" onPress={() => router.push("/compare")} />
        )}
        <GhostButton label="Your full plan" tone="quiet" onPress={() => router.push("/plan")} />
      </View>
    </Screen>
  );
}
