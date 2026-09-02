import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { ACTIVES, ASSESSMENT_DISCLAIMER, type RoutineStep } from "@pore/shared";
import { eraseRecord, readJournal, recordedDays } from "@/lib/journal";
import { CATEGORY_LABELS, CONCERN_LABELS, frequencyLabel } from "@/lib/labels";
import { deleteStoredPhotos, listSessions, storedPhotoCount } from "@/lib/photos";
import { useOnboarding } from "@/state/onboarding";
import {
  AppText,
  Card,
  Chip,
  Divider,
  GhostButton,
  PrimaryButton,
  Screen,
  colors,
  spacing,
} from "@/theme";

/** Plain-language band for a 0..1 confidence, so the number is not the whole story. */
function confidenceLabel(c: number): string {
  if (c >= 0.75) return "High confidence";
  if (c >= 0.5) return "Moderate confidence";
  return "Low confidence";
}

export default function Plan() {
  const { data, update } = useOnboarding();
  const [photoCount, setPhotoCount] = useState(() => storedPhotoCount());
  const [sessionCount, setSessionCount] = useState(() => listSessions().length);
  const [journalDays, setJournalDays] = useState(() => recordedDays(readJournal()));

  // These were read once in useState initialisers and never again, so taking a
  // new photo set and coming back showed the old counts — and hid the "See what
  // changed" button that the new set had just unlocked. today.tsx already reads
  // on focus; this screen now does too.
  useFocusEffect(
    useCallback(() => {
      setPhotoCount(storedPhotoCount());
      setSessionCount(listSessions().length);
      setJournalDays(recordedDays(readJournal()));
    }, []),
  );

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
              // Narrower than deleteJournal on purpose: this control promises
              // the routine survives, and the journal is where the routine now
              // lives. See eraseRecord in lib/journal.ts.
              eraseRecord();
              setJournalDays(0);
            } catch {
              Alert.alert("Couldn't erase", "Something went wrong removing the record. Try again.");
            }
          },
        },
      ],
    );
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

  // No local fallback. This screen used to synthesise a routine and three
  // invented findings ("Acne-like breakouts · moderate") whenever the real plan
  // was missing, and present them as the user's assessment. A plan we did not
  // build is not a plan we get to show.
  const view = useMemo(() => {
    if (!data.plan) return null;
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
  }, [data.plan]);

  if (!view) {
    return (
      <Screen contentStyle={{ paddingTop: spacing.lg }}>
        <AppText variant="label" color={colors.primary}>
          YOUR FULL PLAN
        </AppText>
        <AppText variant="title">Nothing to show yet</AppText>
        <AppText variant="body" color={colors.inkMuted}>
          Your assessment and routine live here once they&apos;ve been built. It takes three photos
          and four questions.
        </AppText>
        <PrimaryButton label="Build my routine" onPress={() => router.push("/onboarding/photo")} />
      </Screen>
    );
  }

  return (
    <Screen contentStyle={{ paddingTop: spacing.lg }}>
      <AppText variant="label" color={colors.primary}>
        YOUR FULL PLAN
      </AppText>
      <AppText variant="title">Everything, in one place</AppText>
      <AppText variant="body" color={colors.inkMuted}>
        {view.summary}
      </AppText>

      <Card elevated>
        <AppText variant="heading">What we noticed</AppText>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs }}>
          {view.concerns.map((c) => (
            <Chip key={c} label={c} />
          ))}
        </View>
        <AppText variant="caption" color={colors.inkMuted}>
          Cosmetic, non-diagnostic appearance only.
        </AppText>
        {view.confidence !== null ? (
          <AppText variant="caption" color={colors.primary}>
            {confidenceLabel(view.confidence)}
            {view.photoQuality.length > 0
              ? ` · ${view.photoQuality.filter((p) => p.flags.length === 0).length} of ${view.photoQuality.length} photos passed the quality check`
              : ""}
          </AppText>
        ) : null}
      </Card>

      {view.limitations.length > 0 && (
        <Card>
          <AppText variant="heading">What we couldn&apos;t see clearly</AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            Saying so is more useful than a confident guess.
          </AppText>
          <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
            {view.limitations.map((l, i) => (
              <AppText key={i} variant="caption" color={colors.ink}>
                • {l}
              </AppText>
            ))}
          </View>
        </Card>
      )}

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

      <RoutineCard title="Morning" steps={view.routine.am} />
      <RoutineCard title="Evening" steps={view.routine.pm} />

      {/* Moved directly under the routine it explains. This card is the whole
          trust argument of the product, and it used to sit below a "Back to
          today" button, so the people most likely to want it never reached it. */}
      {view.adjustments.length > 0 && (
        <Card>
          <AppText variant="heading">What Pore adjusted to keep you safe</AppText>
          <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
            {view.adjustments.map((a, i) => (
              <AppText key={i} variant="caption" color={colors.ink}>
                • {a.detail}
              </AppText>
            ))}
          </View>
        </Card>
      )}

      <Card>
        <AppText variant="caption" color={colors.inkMuted}>
          These are the steps and weekly frequencies your routine is built from. Which of them you
          do on any given day is worked out for you on Today — you never have to plan a night
          yourself.
        </AppText>
      </Card>

      {photoCount > 0 && (
        <Card>
          <AppText variant="heading">Your photos</AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            {photoCount} {photoCount === 1 ? "photo is" : "photos are"} saved on this phone, inside
            the app. They were never uploaded to photo storage and are not on our servers.
          </AppText>
          {/* "See what changed" used to live here, behind sessionCount >= 2,
              which made the progress surface reachable only once you already
              had something to see. It is a tab now. */}
          <GhostButton
            label="Take a new set"
            onPress={() => router.push("/onboarding/photo?mode=recheck")}
          />
          <GhostButton label="Delete my photos" onPress={confirmDeletePhotos} />
        </Card>
      )}

      <Card>
        <AppText variant="heading">Your routine record</AppText>
        <AppText variant="caption" color={colors.inkMuted}>
          {journalDays === 0
            ? "Once you start ticking off steps, this phone keeps a note of what you did and how your skin felt. That record is what lets your routine slow itself down when your skin reacts."
            : `${journalDays} ${journalDays === 1 ? "day" : "days"} recorded on this phone — which steps you did, and how your skin felt. It never leaves your device, and it is what lets your routine slow itself down when your skin reacts.`}
        </AppText>
        {journalDays > 0 && (
          <GhostButton label="Erase my routine record" onPress={confirmEraseJournal} />
        )}
      </Card>

      <Card>
        <AppText variant="caption" color={colors.inkMuted}>
          {ASSESSMENT_DISCLAIMER}
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
      </Card>
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
                {frequencyLabel(s.frequencyPerWeek)}
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
