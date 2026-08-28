import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, View } from "react-native";

import {
  ACTIVES,
  applySafetyRules,
  type ConcernKey,
  type ProductCategory,
  type Routine,
  type RoutineStep,
} from "@pore/shared";
import { buildIntake } from "@/lib/intake";
import { useOnboarding } from "@/state/onboarding";
import { AppText, Card, Chip, Divider, Screen, colors, spacing } from "@/theme";

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

export default function Today() {
  const { data } = useOnboarding();

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
        routine: data.plan.routine,
        adjustments: data.plan.adjustments,
      };
    }
    const { routine, adjustments } = applySafetyRules(draftRoutine(), buildIntake(data));
    return {
      concerns: ["Acne-like breakouts · moderate", "Dark-spot appearance · mild", "Oiliness · noticeable"],
      summary: "A simple routine built around your skin — with only the steps you actually need.",
      escalate: false,
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
      </Card>

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
