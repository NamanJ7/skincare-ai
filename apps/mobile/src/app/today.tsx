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
import { completed, selected, tapped } from "@/lib/feedback";
import { WeekStrip } from "@/components/WeekStrip";
import { buildIntake } from "@/lib/intake";
import { listSessions } from "@/lib/photos";
import {
  checkInFor,
  completedSteps,
  readJournal,
  recordCheckIn,
  sessionsBetween,
  toggleStep,
} from "@/lib/journal";
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

function stepLabel(step: RoutineStep): string {
  return step.active ? ACTIVES[step.active].short : CATEGORY_LABELS[step.category];
}

/**
 * The routine screen proper. Split from the entry component below because the
 * cadence hooks need a routine to run against, and a hook cannot sit behind a
 * conditional — so the "is there a routine at all?" question has to be answered
 * before this component mounts.
 */
function TodaySession({ routine }: { routine: Routine }) {
  const { data } = useOnboarding();
  const [journal, setJournal] = useState(() => readJournal());
  const [time, setTime] = useState<RoutineTime>(() => currentSession());
  /**
   * The day being shown. Defaults to today and usually stays there; the week
   * strip moves it so "what's on Thursday?" is answerable without leaving the
   * screen the user already opened.
   */
  const [viewingDate, setViewingDate] = useState(() => todayDate());
  /** Two capture sessions is what makes /compare able to say anything at all. */
  const [sessionCount] = useState(() => listSessions().length);

  const date = todayDate();
  const intake = useMemo(() => buildIntake(data), [data]);

  // Re-read on focus: the record can be erased from /plan, and a session left
  // open overnight should come back as the new day rather than yesterday's.
  useFocusEffect(
    useCallback(() => {
      setJournal(readJournal());
      setTime(currentSession());
      setViewingDate(todayDate());
    }, []),
  );

  const ctx = useMemo(
    () => ({ startedOn: journal.startedOn, on: viewingDate, checkIns: journal.checkIns }),
    [journal.startedOn, journal.checkIns, viewingDate],
  );

  /**
   * Only today can be written to.
   *
   * Every journal entry is keyed by calendar date, and the ramp and the
   * adherence rate both read back from it. Ticking Thursday off on Monday would
   * put a claim in that record that had not happened yet — the routine would
   * then advance its ramp on the strength of it. Other days are readable, and
   * that is all they are.
   */
  const isToday = viewingDate === date;

  const day = useMemo(() => planDay(routine, intake, ctx), [routine, intake, ctx]);
  // The strip always shows the week the user is actually in, so browsing to
  // another day cannot make the ramp week or the session count jump around.
  const weekCtx = useMemo(
    () => ({ startedOn: journal.startedOn, on: date, checkIns: journal.checkIns }),
    [journal.startedOn, journal.checkIns, date],
  );
  const week = useMemo(() => planWeek(routine, intake, weekCtx), [routine, intake, weekCtx]);

  const session = time === "AM" ? day.am : day.pm;
  const done = completedSteps(journal, viewingDate, time);
  const allDone = session.steps.length > 0 && done.length >= session.steps.length;
  const atFullStrength = week.rampWeek >= week.rampWeeks;
  const doneThisWeek = sessionsBetween(
    journal,
    week.days[0]?.date ?? date,
    week.days[6]?.date ?? date,
  );
  const feeling = checkInFor(journal, date);

  const onToggle = useCallback(
    (order: number) => {
      if (!isToday) return;
      const next = toggleStep(date, time, order, session.steps.length);
      // Finishing gets its own feedback. The last tap of a session should not
      // feel like the third one — it is the moment the routine is done.
      const nowDone = completedSteps(next, date, time).length >= session.steps.length;
      if (nowDone && session.steps.length > 0) completed();
      else tapped();
      setJournal(next);
    },
    [date, time, session.steps.length, isToday],
  );

  const onFeel = useCallback(
    (feel: SkinFeel) => {
      if (!isToday) return;
      selected();
      setJournal(recordCheckIn(date, feel));
    },
    [date, isToday],
  );

  return (
    <Screen contentStyle={{ paddingTop: spacing.lg }}>
      <View style={{ gap: spacing.xxs }}>
        <AppText variant="label" color={colors.primary}>
          {`${(isToday ? "Today" : weekdayName(viewingDate)).toUpperCase()} · ${time === "AM" ? "MORNING" : "EVENING"}`}
        </AppText>
        <AppText variant="title">{session.headline}</AppText>
        {isToday ? (
          doneThisWeek > 0 && (
            <AppText variant="caption" color={colors.inkMuted}>
              {`${doneThisWeek} ${doneThisWeek === 1 ? "session" : "sessions"} done this week.`}
            </AppText>
          )
        ) : (
          <AppText variant="caption" color={colors.inkMuted}>
            A look ahead. You tick steps off on the day itself.
          </AppText>
        )}
      </View>

      <Card elevated>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <AppText variant="heading">
            {!isToday ? "What's on this day" : allDone ? "Done for now" : "Do this now"}
          </AppText>
          {isToday && (
            <AppText variant="caption" color={colors.inkMuted}>
              {`${done.length} of ${session.steps.length}`}
            </AppText>
          )}
        </View>

        <View style={{ marginTop: spacing.xs }}>
          {session.steps.map((step, i) => {
            const checked = done.includes(step.order);
            return (
              <View key={`${step.category}-${step.order}`}>
                {i > 0 && <Divider />}
                <Pressable
                  onPress={() => onToggle(step.order)}
                  disabled={!isToday}
                  accessibilityRole={isToday ? "checkbox" : "text"}
                  accessibilityState={isToday ? { checked } : undefined}
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
        <WeekStrip
          week={week}
          today={date}
          selected={viewingDate}
          // Tapping the day already open flips morning/evening — the switch
          // that used to be a ghost button at the bottom of the scroll.
          onSelectDay={(d) =>
            d === viewingDate ? setTime(time === "AM" ? "PM" : "AM") : setViewingDate(d)
          }
        />
        {/*
         * The forward contract. Week 1 used to say "WEEK 1 OF 6" and nothing
         * else — no statement of what the six weeks are for, or what happens at
         * the end of them. A user who cannot see where the plan is going has no
         * reason to still be here in a month.
         */}
        <AppText variant="caption" color={colors.inkMuted}>
          {atFullStrength
            ? "Your actives are at full strength. Take a new set of photos and we'll measure what actually changed."
            : "Every week your skin stays calm moves your actives one step closer to full strength. Weeks that don't, don't."}
        </AppText>
        {atFullStrength && (
          <GhostButton
            label="Take a new set of photos"
            onPress={() => router.push("/onboarding/photo?mode=recheck")}
          />
        )}
      </Card>

      {/* The single question the product asks. One tap, and it is what moves the
          ramp forward or pulls it back — so the answer is never cosmetic.
          It used to appear only once the session was finished, which locked the
          answer behind the behaviour it exists to correct: someone who stopped
          halfway because their face was stinging is exactly the person whose
          report should pull the actives, and they were the one person who could
          not file it. It is always available now. */}
      {/* Only today. "How does your skin feel?" is a statement about now; there
          is no honest way to answer it for a day that has not happened. */}
      {isToday && (
      <Card elevated>
        <AppText variant="heading">How does your skin feel?</AppText>
        <AppText variant="caption" color={colors.inkMuted}>
          {feeling
            ? "Logged. This is what sets next week's pace — you don't have to adjust anything yourself."
            : "One tap, whether or not you finished. If something stung, say so and we'll ease off."}
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
        {/* The verdict screen used to be three levels deep behind /plan, gated
            on a session count the user was never told about. */}
        {sessionCount >= 2 && (
          <GhostButton label="See what changed" onPress={() => router.push("/compare")} />
        )}
        <GhostButton label="Your full plan" onPress={() => router.push("/plan")} />
      </View>
    </Screen>
  );
}

/**
 * What the screen shows when there is no routine to show.
 *
 * Reachable when plan generation failed, or the record was erased. This screen
 * used to synthesise a hardcoded sample routine in that case — two acids and a
 * daily retinoid — and present it as the user's own, which turned every failure
 * upstream into a silent one. Naming the gap and offering the way forward beats
 * inventing content.
 */
function NoRoutineYet() {
  return (
    <Screen contentStyle={{ paddingTop: spacing.lg }}>
      <AppText variant="label" color={colors.primary}>
        NOT READY YET
      </AppText>
      <AppText variant="title">Your routine isn&apos;t built</AppText>
      <AppText variant="body" color={colors.inkMuted}>
        We don&apos;t have a finished plan for you on this phone. Three photos and a few questions
        is all it takes, and we&apos;ll keep the answers you already gave.
      </AppText>
      <PrimaryButton label="Build my routine" onPress={() => router.push("/onboarding/photo")} />
    </Screen>
  );
}

/**
 * Precedence: a routine the progress engine has already adapted beats the one
 * generated at signup. There is deliberately no third fallback.
 */
export default function Today() {
  const { data } = useOnboarding();
  const [journal, setJournal] = useState(() => readJournal());

  useFocusEffect(
    useCallback(() => {
      setJournal(readJournal());
    }, []),
  );

  const routine = journal.routine ?? data.plan?.routine;
  if (!routine) return <NoRoutineYet />;
  return <TodaySession routine={routine} />;
}
