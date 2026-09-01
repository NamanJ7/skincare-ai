import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import {
  ACTIVES,
  applySafetyRules,
  type ConcernKey,
  type ProductCategory,
  type Routine,
  type RoutineStep,
} from "@pore/shared";
import { buildIntake } from "@/lib/intake";
import { deleteJournal, readJournal, recordedDays } from "@/lib/journal";
import { deleteProfile } from "@/lib/profile";
import { REMINDER_HOURS, disableReminder, enableReminder, formatHour } from "@/lib/reminder";
import { deleteStoredPhotos, listSessions, storedPhotoCount } from "@/lib/photos";
import { useOnboarding } from "@/state/onboarding";
import { AppText, Card, Chip, Disclosure, Divider, GhostButton, Screen, colors, spacing } from "@/theme";

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  cleanser: "Cleanser",
  treatment: "Treatment",
  serum: "Serum",
  moisturizer: "Moisturizer",
  sunscreen: "Sunscreen (SPF)",
  exfoliant: "Exfoliant",
  spot_treatment: "Spot treatment",
};

const CONCERN_LABELS: Record<ConcernKey, string> = {
  acne_like_breakouts: "Acne-like breakouts",
  oiliness: "Oiliness",
  dryness_flaking: "Dryness / flaking",
  texture_congestion: "Texture & congestion",
  uneven_tone: "Uneven tone",
  dark_spot_appearance: "Dark-spot appearance",
  redness_appearance: "Redness appearance",
  fine_line_appearance: "Fine-line appearance",
  irritation_signs: "Signs of irritation",
};

/** Local fallback draft (over-loaded on purpose so the safety engine acts). */
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

/** Plain-language band for a 0..1 confidence, so the number is not the whole story. */
function confidenceLabel(c: number): string {
  if (c >= 0.75) return "High confidence";
  if (c >= 0.5) return "Moderate confidence";
  return "Low confidence";
}

export default function Plan() {
  const { data, update, reset } = useOnboarding();
  const [photoCount, setPhotoCount] = useState(() => storedPhotoCount());
  const [sessionCount] = useState(() => listSessions().length);
  const [journalDays, setJournalDays] = useState(() => recordedDays(readJournal()));

  function confirmEraseJournal() {
    Alert.alert(
      "Erase your routine record?",
      "This removes the tick-offs and skin check-ins stored on this phone. Your routine stays, but it restarts its six-week ramp from today.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Erase",
          style: "destructive",
          onPress: () => {
            try {
              deleteJournal();
              setJournalDays(0);
            } catch {
              Alert.alert("Couldn't erase", "Something went wrong removing the record. Try again.");
            }
          },
        },
      ],
    );
  }

  /**
   * The real "forget me". The journal erase above resets progress but keeps the
   * routine; this removes the answers and the routine themselves, which is the
   * only action that leaves nothing of the user on the device.
   */
  function confirmStartOver() {
    Alert.alert(
      "Erase everything and start over?",
      "This removes your answers, your assessment and your routine from this phone, along with your record. You'll go back to the beginning.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Erase everything",
          style: "destructive",
          onPress: () => {
            try {
              // The reminder is scheduled with the OS, not stored with the
              // profile, so erasing the profile alone would leave a nightly
              // notification for a routine that no longer exists.
              void disableReminder();
              deleteProfile();
              deleteJournal();
              reset();
              router.replace("/");
            } catch {
              Alert.alert("Couldn't erase", "Something went wrong. Try again.");
            }
          },
        },
      ],
    );
  }

  /**
   * Change or clear the daily reminder. Turning it on can fail — the user may
   * decline the OS prompt — so the stored hour is only written once the schedule
   * actually exists. A setting that says "on" while nothing is scheduled is a
   * lie the user has no way to detect.
   */
  async function setReminder(hour: number | null) {
    if (hour === null) {
      await disableReminder();
      update({ reminderHour: undefined });
      return;
    }
    if (await enableReminder(hour)) update({ reminderHour: hour });
    else Alert.alert("Reminders are off", "Pore needs notification permission to send a reminder. You can turn it on in Settings.");
  }

  function confirmDeletePhotos() {
    Alert.alert(
      "Delete your photos?",
      "This removes the photos stored on this phone. Your routine stays.",
      [
        { text: "Keep them", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            try {
              deleteStoredPhotos();
              update({ photos: [] });
              setPhotoCount(0);
            } catch {
              Alert.alert("Couldn't delete", "Something went wrong removing the photos. Try again.");
            }
          },
        },
      ],
    );
  }

  // Prefer the server-generated plan; otherwise run the engine locally so the
  // screen still demonstrates the full flow offline.
  const view = useMemo(() => {
    if (data.plan) {
      const a = data.plan.assessment;
      return {
        concerns: a.findings
          .filter((f) => f.present)
          .map((f) => `${CONCERN_LABELS[f.concern]} · ${f.appearanceLevel}`),
        summary: a.summary,
        escalate: a.escalation.recommendProfessional,
        confidence: a.overallConfidence,
        limitations: a.limitations,
        photoQuality: a.photoQuality,
        routine: data.plan.routine,
        adjustments: data.plan.adjustments,
      };
    }
    const { routine, adjustments } = applySafetyRules(draftRoutine(), buildIntake(data));
    return {
      concerns: ["Acne-like breakouts · moderate", "Dark-spot appearance · mild", "Oiliness · noticeable"],
      summary: "A simple routine built around your skin — with only the steps you actually need.",
      escalate: false,
      confidence: null,
      limitations: [],
      photoQuality: [],
      routine,
      adjustments,
    };
  }, [data]);

  return (
    <Screen contentStyle={{ paddingTop: spacing.lg }}>
      <AppText variant="label" color={colors.primary}>
        YOUR ROUTINE
      </AppText>
      <AppText variant="title">Everything, in one place</AppText>
      <AppText variant="body" color={colors.inkMuted}>
        {view.summary}
      </AppText>

      {/*
       * Escalation sits above everything and is never collapsed. It is the one
       * thing on this screen that could matter today, and a safety cue behind a
       * tap is a safety cue that does not exist.
       */}
      {view.escalate && (
        <Card>
          <AppText variant="bodyStrong" color={colors.escalate}>
            Worth checking with a professional
          </AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            Some of what&apos;s visible may be better looked at by a pharmacist or doctor.
          </AppText>
        </Card>
      )}

      {/* The routine first. It is what the screen was opened for. */}
      <RoutineCard title="Morning" steps={view.routine.am} />
      <RoutineCard title="Evening" steps={view.routine.pm} />

      <AppText variant="caption" color={colors.inkMuted}>
        These are the steps and weekly frequencies your routine is built from. Which of them you do
        on any given night is worked out for you on Today — you never have to plan one yourself.
      </AppText>

      {/*
       * The receipt. Everything under here is the chain that produced the
       * routine above, in the order it actually happened: what the photos
       * showed, what they could not show, and what the safety engine changed
       * afterwards. Collapsed, because it is the answer to "why?" and nobody
       * asks that first.
       */}
      <Disclosure
        title="Why this routine"
        summary={
          view.confidence !== null
            ? `${confidenceLabel(view.confidence)}${
                view.photoQuality.length > 0
                  ? ` · ${view.photoQuality.filter((p) => p.flags.length === 0).length} of ${view.photoQuality.length} photos passed the quality check`
                  : ""
              }`
            : "What we saw, what we couldn't, and what we changed."
        }
      >
        <View style={{ gap: spacing.xs }}>
          <AppText variant="bodyStrong">What we noticed</AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {view.concerns.map((c) => (
              <Chip key={c} label={c} />
            ))}
          </View>
          <AppText variant="caption" color={colors.inkMuted}>
            Cosmetic, non-diagnostic appearance only.
          </AppText>
        </View>

        {view.limitations.length > 0 && (
          <View style={{ gap: spacing.xs }}>
            <Divider />
            <AppText variant="bodyStrong">What we couldn&apos;t see clearly</AppText>
            <AppText variant="caption" color={colors.inkMuted}>
              Saying so is more useful than a confident guess.
            </AppText>
            {view.limitations.map((l, i) => (
              <AppText key={i} variant="caption" color={colors.ink}>
                • {l}
              </AppText>
            ))}
          </View>
        )}

        {view.adjustments.length > 0 && (
          <View style={{ gap: spacing.xs }}>
            <Divider />
            <AppText variant="bodyStrong">What we changed to keep you safe</AppText>
            {view.adjustments.map((a, i) => (
              <AppText key={i} variant="caption" color={colors.ink}>
                • {a.detail}
              </AppText>
            ))}
          </View>
        )}
      </Disclosure>

      {/* Settings and stored data. One section, all the erase paths together. */}
      <Disclosure
        title="Your data"
        summary="Photos, your record, reminders — and how to erase any of it."
      >
        {photoCount > 0 && (
          <View style={{ gap: spacing.xs }}>
            <AppText variant="bodyStrong">Your photos</AppText>
            <AppText variant="caption" color={colors.inkMuted}>
              {photoCount} {photoCount === 1 ? "photo is" : "photos are"} saved on this phone,
              inside the app. They were never uploaded to photo storage and are not on our servers.
            </AppText>
            {sessionCount >= 2 && (
              <GhostButton label="See what changed" onPress={() => router.push("/compare")} />
            )}
            <GhostButton
              label="Take a new set"
              onPress={() => router.push("/onboarding/photo?mode=recheck")}
            />
            <GhostButton label="Delete my photos" onPress={confirmDeletePhotos} />
          </View>
        )}

        <View style={{ gap: spacing.xs }}>
          {photoCount > 0 && <Divider />}
          <AppText variant="bodyStrong">Your routine record</AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            {journalDays === 0
              ? "Once you start ticking off steps, this phone keeps a note of what you did and how your skin felt. That record is what lets your routine slow itself down when your skin reacts."
              : `${journalDays} ${journalDays === 1 ? "day" : "days"} recorded on this phone — which steps you did, and how your skin felt. It never leaves your device, and it is what lets your routine slow itself down when your skin reacts.`}
          </AppText>
          {journalDays > 0 && (
            <GhostButton label="Erase my routine record" onPress={confirmEraseJournal} />
          )}
        </View>

        <View style={{ gap: spacing.xs }}>
          <Divider />
          <AppText variant="bodyStrong">Evening reminder</AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            {data.reminderHour === undefined
              ? "Off. One nudge a day at a time you pick — the only notification Pore sends."
              : `On, at ${formatHour(data.reminderHour)}. This is the only notification Pore sends.`}
          </AppText>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
            {REMINDER_HOURS.map((h) => (
              <Chip
                key={h}
                label={formatHour(h)}
                role="radio"
                selected={data.reminderHour === h}
                onPress={() => void setReminder(h)}
              />
            ))}
          </View>
          {data.reminderHour !== undefined && (
            <GhostButton label="Turn the reminder off" onPress={() => void setReminder(null)} />
          )}
        </View>

        <View style={{ gap: spacing.xs }}>
          <Divider />
          <AppText variant="bodyStrong">Your answers</AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            The answers you gave at signup and the routine built from them are saved on this phone,
            so your plan is still here the next time you open the app. They stay on the device.
          </AppText>
          <GhostButton label="Erase everything and start over" onPress={confirmStartOver} />
        </View>
      </Disclosure>

      <GhostButton label="Back to today" onPress={() => router.replace("/today")} />

      <View style={{ gap: spacing.xs }}>
        <AppText variant="caption" color={colors.inkMuted}>
          Pore offers cosmetic skincare guidance, not medical advice. If something looks painful, is
          bleeding, spreading quickly, or isn&apos;t improving, please check in with a pharmacist or
          doctor.
        </AppText>
        <Pressable
          onPress={() => router.push("/legal/terms")}
          accessibilityRole="link"
          accessibilityLabel="Read the Terms of Use"
          style={({ pressed }) => [
            { minHeight: 44, justifyContent: "center" },
            pressed && { opacity: 0.6 },
          ]}
        >
          <AppText variant="caption" color={colors.primary}>
            Read the Terms of Use
          </AppText>
        </Pressable>
      </View>
    </Screen>
  );
}

function RoutineCard({ title, steps }: { title: string; steps: RoutineStep[] }) {
  return (
    <Card elevated>
      <AppText variant="heading">{title}</AppText>
      <View style={{ gap: spacing.sm, marginTop: spacing.xs }}>
        {steps.map((s, i) => (
          <View key={`${s.category}-${i}`} style={{ gap: spacing.xs }}>
            {i > 0 && <Divider />}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <AppText variant="bodyStrong">
                {s.order}. {s.active ? ACTIVES[s.active].label : CATEGORY_LABELS[s.category]}
              </AppText>
              <AppText variant="caption" color={colors.primary}>
                {s.frequencyPerWeek >= 7 ? "Daily" : `${s.frequencyPerWeek}x / week`}
              </AppText>
            </View>
            <AppText variant="caption" color={colors.inkMuted}>
              {s.rationale}
            </AppText>
          </View>
        ))}
      </View>
    </Card>
  );
}
