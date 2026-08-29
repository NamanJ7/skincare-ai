import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";

import { fetchPlan } from "@/lib/api";
import { buildIntake } from "@/lib/intake";
import { useOnboarding } from "@/state/onboarding";
import { AppText, Card, PrimaryButton, Screen, colors, radius, spacing } from "@/theme";

const TIPS = [
  "Face a window or soft light — avoid harsh shadows",
  "Remove makeup and glasses",
  "Hold the phone at eye level, fill the frame with your face",
];

export default function PhotoCapture() {
  const { data, update } = useOnboarding();
  const [analyzing, setAnalyzing] = useState(false);

  async function analyze() {
    setAnalyzing(true);
    // Real camera capture lands here next; for now we send the intake and let
    // the server (or the local fallback) produce the plan.
    const plan = await fetchPlan({
      images: [],
      intake: buildIntake(data),
      parentalConsent:
        data.parentalConsentId && data.parentEmail
          ? { id: data.parentalConsentId, parentEmail: data.parentEmail }
          : undefined,
    });
    if (plan) update({ plan });
    router.replace("/today");
  }

  return (
    <Screen contentStyle={{ paddingTop: spacing.lg }}>
      <AppText variant="title">Let&apos;s look at your skin</AppText>
      <AppText variant="body" color={colors.inkMuted}>
        We&apos;ll guide you through a few photos so the read is accurate. This is a cosmetic look at what&apos;s
        visible — never a diagnosis.
      </AppText>

      <View
        style={{
          aspectRatio: 3 / 4,
          borderRadius: radius.xl,
          borderWidth: 2,
          borderColor: colors.primary,
          borderStyle: "dashed",
          backgroundColor: colors.surface,
          alignItems: "center",
          justifyContent: "center",
          marginVertical: spacing.md,
        }}
      >
        <AppText variant="caption" color={colors.inkMuted}>
          Camera preview
        </AppText>
        <AppText variant="caption" color={colors.inkMuted}>
          (guided capture coming in the next build)
        </AppText>
      </View>

      <Card>
        {TIPS.map((tip, i) => (
          <AppText key={i} variant="caption" color={colors.ink}>
            • {tip}
          </AppText>
        ))}
      </Card>

      {analyzing ? (
        <View style={{ alignItems: "center", gap: spacing.sm, paddingVertical: spacing.md }}>
          <ActivityIndicator color={colors.primary} />
          <AppText variant="caption" color={colors.inkMuted}>
            Reading your skin and building a routine…
          </AppText>
        </View>
      ) : (
        <PrimaryButton label="Analyze my skin" onPress={analyze} />
      )}

      {/* Existing privacy line, now a route into the full Privacy Policy. */}
      <Pressable
        onPress={() => router.push("/legal/privacy")}
        accessibilityRole="link"
        accessibilityLabel="Pore doesn't store your photos. Read the Privacy Policy."
        style={({ pressed }) => [
          { minHeight: 44, justifyContent: "center" },
          pressed && { opacity: 0.6 },
        ]}
      >
        <AppText variant="caption" color={colors.inkMuted} style={{ textAlign: "center" }}>
          Pore doesn&apos;t store your photos — they&apos;re used for this analysis only.
        </AppText>
        <AppText variant="caption" color={colors.primary} style={{ textAlign: "center" }}>
          Read the Privacy Policy
        </AppText>
      </Pressable>
    </Screen>
  );
}
