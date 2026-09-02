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
  currentSession,
  planDay,
  planWeek,
  today as todayDate,
  weekdayName,
  type IntakeResponse,
  type Routine,
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
  type Journal,
} from "@/lib/journal";
import { stepLabel } from "@/lib/labels";
import { useOnboarding } from "@/state/onboarding";
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

const FEELS: { feel: SkinFeel; label: string }[] = [
  { feel: "calm", label: "Calm" },
  { feel: "tight", label: "Tight" },
  { feel: "stinging", label: "Stinging" },
];

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

  // Precedence: a routine the progress engine has already adapted beats the one
  // generated at signup. There is deliberately no third fallback — this screen
  // used to synthesise a demo routine when both were missing and present it as
  // the user's own, which turned every failure upstream into a silent one.
  const routine = journal.routine ?? data.plan?.routine;

  if (!routine) return <NoRoutineYet />;
  return (
    <TodaySession
      routine={routine}
      journal={journal}
      setJournal={setJournal}
      time={time}
      setTime={setTime}
      date={date}
      intake={intake}
    />
  );
}

/**
 * What the screen shows when there is no routine to show.
 *
 * Reachable if generation failed, or the record was erased. Naming that plainly
 * and offering the way forward beats the old behaviour, which was to render a
 * hardcoded sample routine as though it had been built for this person.
 */
function NoRoutineYet() {
  return (
    <Screen contentStyle={{ paddingTop: spacing.lg }}>
      <AppText variant="label" color={colors.primary}>
        NOT READY YET
      </AppText>
      <AppText variant="title">Your routine isn&apos;t built</AppText>
      <AppText variant="body" color={colors.inkMuted}>
        We don&apos;t have a finished plan for you on this phone. Three photos and four questions is
        all it takes, and we&apos;ll keep the answers you already gave.
      </AppText>
      <PrimaryButton label="Build my routine" onPress={() => router.push("/onboarding/photo")} />
    </Screen>
  );
}

function TodaySession({
  routine,
  journal,
  setJournal,
  time,
  setTime,
  date,
  intake,
}: {
  routine: Routine;
  journal: Journal;
  setJournal: (j: Journal) => void;
  time: RoutineTime;
  setTime: (t: RoutineTime) => void;
  date: string;
  intake: IntakeResponse;
}) {
  const ctx = useMemo(
    () => ({ startedOn: journal.startedOn, on: date, checkIns: journal.checkIns }),
    [journal.startedOn, journal.checkIns, date],
  );

  const day = useMemo(() => planDay(routine, intake, ctx), [routine, intake, ctx]);
  const week = useMemo(() => planWeek(routine, intake, ctx), [routine, intake, ctx]);

  const session = time === "AM" ? day.am : day.pm;
  const done = completedSteps(journal, date, time);
  const allDone = session.steps.length > 0 && done.length >= session.steps.length;
  const started = done.length > 0;
  const streak = streakDays(journal, date);
  const feeling = checkInFor(journal, date);
  const evening = time === "PM";

  const onToggle = useCallback(
    (order: number) => setJournal(toggleStep(date, time, order, session.steps.length)),
    [date, time, session.steps.length, setJournal],
  );

  const onFeel = useCallback(
    (feel: SkinFeel) => setJournal(recordCheckIn(date, feel)),
    [date, setJournal],
  );

  return (
    <Screen contentStyle={{ paddingTop: spacing.lg }}>
      <View style={{ gap: spacing.xxs }}>
        <AppText variant="label" color={colors.primary}>
          {`${weekdayName(date).toUpperCase()} · ${time === "AM" ? "MORNING" : "EVENING"}`}
        </AppText>
        <AppText variant="title">{session.headline}</AppText>
        {/* The first completed day used to pass in silence (streak >= 2), which
            is exactly the moment someone decides whether this is a thing they
            do now. Day one gets acknowledged. */}
        {streak >= 1 && (
          <AppText variant="caption" color={colors.inkMuted}>
            {streak === 1 ? "First day done." : `${streak} days in a row.`}
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
        {/* Finishing used to just stop. Saying what comes next is the difference
            between an ending and a loop. */}
        {allDone && (
          <AppText variant="caption" color={colors.inkMuted}>
            {evening
              ? "That's tonight finished. Next up is tomorrow morning."
              : "That's this morning finished. Next up is tonight."}
          </AppText>
        )}

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
          {/* Was hardcoded to "tonight", so it said so at eight in the morning. */}
          <AppText variant="heading">
            {evening ? "Why tonight looks like this" : "Why this morning looks like this"}
          </AppText>
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
          ramp forward or pulls it back — so the answer is never cosmetic.

          This used to be gated on `allDone || feeling`, so someone who did three
          of four steps was never asked. The schedule engine reads a week with no
          check-ins as calm and advances the ramp on it, which meant Pore was
          escalating actives on the strength of an answer it had never shown the
          user. Anyone who has started the session can answer it. */}
      {(started || allDone || feeling) && (
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
