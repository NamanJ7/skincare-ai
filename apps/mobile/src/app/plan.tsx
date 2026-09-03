/**
 * The full plan — the reference document behind /today.
 *
 * Everything the user might want to check but never has to decide: what the
 * assessment saw, what it declined to call, the whole AM/PM routine with weekly
 * frequencies, and every adjustment the safety engine made on their behalf.
 *
 * This screen used to invent its contents when the in-memory plan was missing:
 * a hardcoded routine and three hardcoded "findings" about the user's face,
 * rendered under "What we noticed". After a restart that was the only state it
 * ever had. It now reads the on-device record, and when there is nothing there
 * it says so.
 */
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, Pressable, View } from "react-native";

import { ACTIVES, type ConcernKey, type ProductCategory, type RoutineStep } from "@pore/shared";
import {
  activeRoutine,
  deleteJournal,
  eraseRecord,
  readJournal,
  recordedDays,
} from "@/lib/journal";
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

/** Plain-language band for a 0..1 confidence, so the number is not the whole story. */
function confidenceLabel(c: number): string {
  if (c >= 0.75) return "High confidence";
  if (c >= 0.5) return "Moderate confidence";
  return "Low confidence";
}

export default function Plan() {
  const { update } = useOnboarding();
  const [journal, setJournal] = useState(() => readJournal());
  const [photoCount, setPhotoCount] = useState(() => storedPhotoCount());
  const [sessionCount, setSessionCount] = useState(() => listSessions().length);

  // These used to be one-shot lazy initialisers, so the counts went stale the
  // moment the user took a new set or came back from /compare — this screen
  // stays mounted underneath both.
  useFocusEffect(
    useCallback(() => {
      setJournal(readJournal());
      setPhotoCount(storedPhotoCount());
      setSessionCount(listSessions().length);
    }, []),
  );

  const routine = activeRoutine(journal);
  const plan = journal.plan;
  const assessment = plan?.assessment;
  const journalDays = recordedDays(journal);

  function confirmEraseRecord() {
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
              setJournal(eraseRecord());
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
      "Erase your photos?",
      "This removes the photos stored on this phone. Your routine stays, but there will be nothing to compare a future set against.",
      [
        { text: "Keep them", style: "cancel" },
        {
          text: "Erase",
          style: "destructive",
          onPress: () => {
            try {
              deleteStoredPhotos();
              update({ photos: [] });
              setPhotoCount(0);
              setSessionCount(0);
            } catch {
              Alert.alert("Couldn't erase", "Something went wrong removing the photos. Try again.");
            }
          },
        },
      ],
    );
  }

  function confirmForgetEverything() {
    Alert.alert(
      "Erase everything?",
      "This removes your routine, your assessment, your photos and your record from this phone. There is no copy anywhere else, so this cannot be undone.",
      [
        { text: "Keep my data", style: "cancel" },
        {
          text: "Erase everything",
          style: "destructive",
          onPress: () => {
            try {
              deleteStoredPhotos();
              deleteJournal();
              update({ photos: [], plan: undefined });
              router.replace("/today");
            } catch {
              Alert.alert("Couldn't erase", "Something went wrong. Try again.");
            }
          },
        },
      ],
    );
  }

  if (!routine) {
    return (
      <Screen contentStyle={{ paddingTop: spacing.section }}>
        <AppText variant="label" color={colors.primary}>
          YOUR FULL PLAN
        </AppText>
        <AppText variant="title">Nothing here yet</AppText>
        <AppText variant="body" color={colors.inkMuted}>
          Once you&apos;ve been through the guided photos and the questions, this is where the full
          reading and every step of your routine lives.
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

  const concerns = (assessment?.findings ?? [])
    .filter((f) => f.present)
    .map((f) => `${CONCERN_LABELS[f.concern]} · ${f.appearanceLevel}`);

  return (
    <Screen contentStyle={{ paddingTop: spacing.lg }}>
      <AppText variant="label" color={colors.primary}>
        YOUR FULL PLAN
      </AppText>
      <AppText variant="title">Everything, in one place</AppText>
      {assessment ? (
        <AppText variant="body" color={colors.inkMuted}>
          {assessment.summary}
        </AppText>
      ) : null}

      {/* A mock reading is a fabrication. This product's whole claim is that it
          does not fabricate readings, so when one is a sample, it says so. */}
      {plan?.mode === "mock" && (
        <Card>
          <AppText variant="bodyStrong" color={colors.caution}>
            This is a sample reading
          </AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            This build isn&apos;t connected to the analysis service, so nothing below was measured
            from your photos. The routine is still clamped by the same safety rules.
          </AppText>
        </Card>
      )}

      {assessment ? (
        <Card elevated>
          <AppText variant="heading">What we noticed</AppText>
          {concerns.length > 0 ? (
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs }}>
              {concerns.map((c) => (
                <Chip key={c} label={c} />
              ))}
            </View>
          ) : (
            <AppText variant="caption" color={colors.ink}>
              Nothing stood out clearly enough to name. That is a result, not a blank.
            </AppText>
          )}
          <AppText variant="caption" color={colors.inkMuted}>
            Cosmetic, non-diagnostic appearance only.
          </AppText>
          <AppText variant="caption" color={colors.primary}>
            {confidenceLabel(assessment.overallConfidence)}
            {assessment.photoQuality.length > 0
              ? ` · ${assessment.photoQuality.filter((p) => p.flags.length === 0).length} of ${assessment.photoQuality.length} photos passed the quality check`
              : ""}
          </AppText>
        </Card>
      ) : null}

      {assessment && assessment.limitations.length > 0 && (
        <Card>
          <AppText variant="heading">What we couldn&apos;t see clearly</AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            Saying so is more useful than a confident guess.
          </AppText>
          <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
            {assessment.limitations.map((l, i) => (
              <AppText key={i} variant="caption" color={colors.ink}>
                • {l}
              </AppText>
            ))}
          </View>
        </Card>
      )}

      {assessment?.escalation.recommendProfessional && (
        <Card>
          <AppText variant="bodyStrong" color={colors.escalate}>
            Worth checking with a professional
          </AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            Some of what&apos;s visible may be better looked at by a pharmacist or doctor.
          </AppText>
        </Card>
      )}

      <RoutineCard title="Morning" steps={routine.am} />
      <RoutineCard title="Evening" steps={routine.pm} />

      <Card>
        <AppText variant="caption" color={colors.inkMuted}>
          These are the steps and weekly frequencies your routine is built from. Which of them you
          do on any given day is worked out for you on Today — you never have to plan a night
          yourself.
        </AppText>
      </Card>

      {plan && plan.adjustments.length > 0 && (
        <Card>
          <AppText variant="heading">What Pore adjusted to keep you safe</AppText>
          <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
            {plan.adjustments.map((a, i) => (
              <AppText key={i} variant="caption" color={colors.ink}>
                • {a.detail}
              </AppText>
            ))}
          </View>
        </Card>
      )}

      {/* "Take a new set" used to live inside `photoCount > 0`, so erasing your
          photos removed the only route back into capture anywhere in the app —
          permanently orphaning the routine from any future measurement. */}
      <Card>
        <AppText variant="heading">Your photos</AppText>
        <AppText variant="caption" color={colors.inkMuted}>
          {photoCount > 0
            ? `${photoCount} ${photoCount === 1 ? "photo is" : "photos are"} saved on this phone, inside the app. They are sent for analysis and never stored on our servers.`
            : "No photos are saved on this phone. A new set is what lets us measure change instead of guessing at it."}
        </AppText>
        <PrimaryButton
          label={photoCount > 0 ? "Take a new set" : "Take your first set"}
          onPress={() => router.push("/onboarding/photo?mode=recheck")}
        />
        {sessionCount >= 2 && (
          <GhostButton label="See what changed" onPress={() => router.push("/compare")} />
        )}
      </Card>

      <Card>
        <AppText variant="heading">Your routine record</AppText>
        <AppText variant="caption" color={colors.inkMuted}>
          {journalDays === 0
            ? "Once you start ticking off steps, this phone keeps a note of what you did and how your skin felt. That record is what lets your routine slow itself down when your skin reacts."
            : `${journalDays} ${journalDays === 1 ? "day" : "days"} recorded on this phone — which steps you did, and how your skin felt. It never leaves your device, and it is what lets your routine slow itself down when your skin reacts.`}
        </AppText>
      </Card>

      {/* Destructive actions, together and visually distinct. They used to be
          six identical ghost buttons scattered between the retention actions. */}
      <Card>
        <AppText variant="heading">Erase my data</AppText>
        <AppText variant="caption" color={colors.inkMuted}>
          Everything Pore knows about you is on this phone, so erasing it here erases it entirely.
        </AppText>
        <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
          {journalDays > 0 && (
            <GhostButton label="Erase my routine record" tone="danger" onPress={confirmEraseRecord} />
          )}
          {photoCount > 0 && (
            <GhostButton label="Erase my photos" tone="danger" onPress={confirmDeletePhotos} />
          )}
          <GhostButton label="Erase everything" tone="danger" onPress={confirmForgetEverything} />
        </View>
      </Card>

      <Card>
        <AppText variant="caption" color={colors.inkMuted}>
          Pore offers cosmetic skincare guidance, not medical advice. If something looks painful, is bleeding,
          spreading quickly, or isn&apos;t improving, please check in with a pharmacist or doctor.
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
