/** Scan intro — sets expectations, then hands off to the guided capture. */
import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

import { MascotCompanion } from "@/components/mascot/MascotCompanion";
import { photoPrivacyLine } from "@/lib/analysis-status";
import { track } from "@/lib/analytics";
import { createPhotoAnalysisConsent } from "@/lib/consent";
import { funnelProgress } from "@/lib/funnel-progress";
import type { ScanMode } from "@/lib/nav";
import { useOnboarding } from "@/state/onboarding";
import {
  AppText,
  Callout,
  OptionRow,
  PrimaryButton,
  ProgressBar,
  Screen,
  TextButton,
  spacing,
  useThemeColors,
} from "@/theme";

const DEMO_SELFIE = require("../../../assets/images/demo-selfie-v1.png");

const REQUIREMENTS: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  detail: string;
}[] = [
  {
    icon: "sunny-outline",
    title: "Soft front light",
    detail: "Face a window; avoid strong light behind or directly above you.",
  },
  {
    icon: "sparkles-outline",
    title: "Clear, clean view",
    detail: "Clean the lens and move hair, glasses, makeup, and coverings away if you can.",
  },
  {
    icon: "phone-portrait-outline",
    title: "Phone at eye level",
    detail: "Keep one face in frame. Pore guides distance and all three angles.",
  },
];

export default function ScanIntro() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ mode?: string }>();
  const mode: ScanMode = params.mode === "rescan" ? "rescan" : "onboarding";
  const { data, update } = useOnboarding();
  // Consent is deliberately unchecked on every visit. A stored record guards
  // capture, but it never turns this disclosure into implied acceptance.
  const [accepted, setAccepted] = useState(false);

  const progress = funnelProgress("scan");

  useEffect(() => {
    if (mode === "onboarding") {
      track("onboarding_step_viewed", { step_id: "scan" });
    }
  }, [mode]);

  return (
    <Screen
      contentStyle={{ paddingTop: spacing.section, justifyContent: "center" }}
    >
      {/* Funnel progress continues here during onboarding. */}
      {mode === "onboarding" ? (
        <ProgressBar
          value={progress.step / progress.total}
          from={progress.from}
        />
      ) : null}
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <AppText variant="overline" color={colors.actionPrimary}>
            GUIDED SKIN SCAN
          </AppText>
          <AppText variant="title">Three photos, guided step by step</AppText>
          <AppText variant="body" color={colors.textSecondary}>
            Pore can use clear photos to support cosmetic observations and
            routine choices. It cannot diagnose a skin condition.
          </AppText>
        </View>
        <MascotCompanion
          state="guiding"
          size="md"
          accessibilityLabel="Pore companion ready to guide your scan"
        />
      </View>

      <ScanPrepVisual />

      <Callout tone="info" icon="aperture-outline" title="Three checks before capture">
        {REQUIREMENTS.map((tip) => (
          <View
            key={tip.title}
            style={{
              flexDirection: "row",
              gap: spacing.xs,
              alignItems: "flex-start",
            }}
          >
            <Ionicons
              name={tip.icon}
              size={16}
              color={colors.onInfo}
              accessible={false}
              style={{ marginTop: 1 }}
            />
            <View style={{ flex: 1, gap: 1 }}>
              <AppText variant="bodyStrong" color={colors.textPrimary}>
                {tip.title}
              </AppText>
              <AppText variant="caption" color={colors.textSecondary}>
                {tip.detail}
              </AppText>
            </View>
          </View>
        ))}
      </Callout>

      <Callout
        tone="info"
        icon="shield-checkmark-outline"
        title="Before the camera opens"
      >
        <AppText variant="caption" color={colors.textPrimary}>
          With your permission, Pore uses three face photos and your answers for
          cosmetic observations and routine choices. It cannot diagnose a skin
          condition.
        </AppText>
        <AppText variant="caption" color={colors.textPrimary}>
          {photoPrivacyLine()} Photos are not used to train models. You can use
          answers only or delete saved photos from Profile.
        </AppText>
      </Callout>

      {Platform.OS === "web" ? (
        <Callout tone="caution" icon="globe-outline" title="Browser preview">
          <AppText variant="caption" color={colors.textPrimary}>
            Browser photos can be saved to your timeline, but this build does
            not analyze them. Use the iOS app for the validated guided scan.
          </AppText>
        </Callout>
      ) : null}

      <OptionRow
        label={
          data.age !== undefined && data.age <= 15
            ? "I want to use the scan and understand what happens"
            : "I agree to this photo processing"
        }
        hint={
          data.age !== undefined && data.age <= 15
            ? "My parent or guardian already authorized this option"
            : "I understand I can continue with answers only"
        }
        multi
        selected={accepted}
        onPress={() => setAccepted((value) => !value)}
      />

      <View style={{ gap: spacing.xs, marginTop: spacing.md }}>
        <PrimaryButton
          label="Start scan"
          disabled={!accepted}
          onPress={() => {
            if (!accepted) return;
            if (mode === "onboarding") {
              track("onboarding_step_completed", { step_id: "scan" });
            }
            update({ photoAnalysisConsent: createPhotoAnalysisConsent() });
            track("scan_started", { mode });
            router.push(`/scan-flow/capture?mode=${mode}`);
          }}
        />
        {mode === "onboarding" ? (
          <TextButton
            label="Use answers only"
            onPress={() => {
              track("onboarding_step_completed", { step_id: "scan" });
              router.replace("/onboarding/generating");
            }}
          />
        ) : (
          <TextButton label="Not now" onPress={() => router.back()} />
        )}
      </View>
    </Screen>
  );
}

function createStyles(colors: ReturnType<typeof useThemeColors>) {
  return StyleSheet.create({
  hero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  prepVisual: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  prepFrame: {
    flex: 1,
    minHeight: 142,
    overflow: "hidden",
    borderRadius: 18,
    backgroundColor: colors.cameraSurface,
  },
  prepImage: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  prepDim: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.cameraScrim,
  },
  prepBadge: {
    position: "absolute",
    left: spacing.xs,
    right: spacing.xs,
    bottom: spacing.xs,
    minHeight: 30,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xxs,
    borderRadius: 999,
    backgroundColor: colors.surfaceFade,
    paddingHorizontal: spacing.xs,
  },
  });
}

function ScanPrepVisual() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View
      style={styles.prepVisual}
      accessible
      accessibilityLabel="Scan setup example. Ready: face evenly lit and centered. Adjust: face is backlit or too dark."
    >
      <View style={styles.prepFrame}>
        <Image
          source={DEMO_SELFIE}
          contentFit="cover"
          contentPosition="center"
          style={styles.prepImage}
          accessible={false}
        />
        <View style={styles.prepBadge}>
          <Ionicons
            name="checkmark-circle"
            size={16}
            color={colors.onSuccess}
          />
          <AppText variant="label" color={colors.textPrimary}>Ready</AppText>
        </View>
      </View>
      <View style={styles.prepFrame}>
        <Image
          source={DEMO_SELFIE}
          contentFit="cover"
          contentPosition={{ left: "42%", top: "50%" }}
          style={styles.prepImage}
          accessible={false}
        />
        <View style={styles.prepDim} />
        <View style={styles.prepBadge}>
          <Ionicons
            name="sunny-outline"
            size={16}
            color={colors.onWarning}
          />
          <AppText variant="label" color={colors.textPrimary}>
            Add front light
          </AppText>
        </View>
      </View>
    </View>
  );
}
