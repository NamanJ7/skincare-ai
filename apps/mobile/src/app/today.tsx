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
import { deleteStoredPhotos, listSessions, storedPhotoCount } from "@/lib/photos";
import { useOnboarding } from "@/state/onboarding";
import { AppText, Card, Chip, Divider, GhostButton, Screen, colors, spacing } from "@/theme";

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

/**
 * The example routine shown when no plan was generated (no API URL configured).
 * Over-loaded on purpose so the safety engine visibly acts on it. It is never
 * presented as a read of anyone's skin — see the demo banner below.
 */
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

export default function Today() {
  const { data, update, reset } = useOnboarding();
  const [photoCount, setPhotoCount] = useState(() => storedPhotoCount());
  const [sessionCount] = useState(() => listSessions().length);

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

  function confirmDeleteRoutine() {
    Alert.alert(
      "Delete your routine?",
      "This removes the saved routine and the answers behind it from this phone. Your photos stay.",
      [
        { text: "Keep it", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            reset();
            router.replace("/");
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
        demo: false,
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
    // No plan: show what the safety engine does to an example routine. There
    // are deliberately no findings here — inventing them would put words in the
    // model's mouth about a face it never saw.
    const { routine, adjustments } = applySafetyRules(draftRoutine(), buildIntake(data));
    return {
      demo: true,
      concerns: [],
      summary: "An example of how Pore builds and corrects a routine.",
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
        TODAY
      </AppText>
      <AppText variant="title">Here&apos;s your plan</AppText>
      <AppText variant="body" color={colors.inkMuted}>
        {view.summary}
      </AppText>

      {view.demo ? (
        <Card elevated>
          <AppText variant="heading">Example routine</AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            No skin analysis ran, so nothing here is based on your photos. This shows how the
            routine and its safety corrections work.
          </AppText>
        </Card>
      ) : (
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
      )}

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

      {photoCount > 0 && (
        <Card>
          <AppText variant="heading">Your photos</AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            {photoCount} {photoCount === 1 ? "photo is" : "photos are"} saved on this phone, inside
            the app. They were never uploaded to photo storage and are not on our servers.
          </AppText>
          {sessionCount >= 2 && (
            <GhostButton label="Compare progress" onPress={() => router.push("/compare")} />
          )}
          <GhostButton label="Delete my photos" onPress={confirmDeletePhotos} />
        </Card>
      )}

      {data.plan && (
        <Card>
          <AppText variant="heading">Your routine</AppText>
          <AppText variant="caption" color={colors.inkMuted}>
            Saved on this phone so it&apos;s here when you come back. It was never uploaded to
            an account — there isn&apos;t one yet.
          </AppText>
          <GhostButton label="Delete my routine" onPress={confirmDeleteRoutine} />
        </Card>
      )}

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
