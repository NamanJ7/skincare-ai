/**
 * Honest Plus-interest surface. Purchases are deliberately disabled until StoreKit
 * entitlement sync exists; the CTA records intent without unlocking anything
 * or implying that a trial started.
 */
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { View } from "react-native";

import { needsGuardianPurchaseApproval } from "@pore/shared";

import { track } from "@/lib/analytics";
import { FEATURE_COPY, type PremiumFeature } from "@/lib/gate";
import { useEntitlement } from "@/state/entitlement";
import { useOnboarding } from "@/state/onboarding";
import {
  AppText,
  Callout,
  PrimaryButton,
  Screen,
  TextButton,
  spacing,
  useThemeColors,
} from "@/theme";

const VALUE = [
  "Weekly follow-up scans after your included first comparison",
  "Ongoing progress history and adaptive weekly reports",
  "Routine adjustments when your skin or goals change",
  "Unlimited complete Active Compatibility checks",
  "Custom routine times and sunscreen reminders",
] as const;

const FEATURE_VALUE_LINE: Record<PremiumFeature, (typeof VALUE)[number]> = {
  rescan: VALUE[0],
  weekly_report: VALUE[1],
  shelf_detail: VALUE[3],
  reminders: VALUE[4],
};

export function PaywallContent({
  mode,
  feature,
}: {
  mode: "onboarding" | "upsell";
  feature?: PremiumFeature;
}) {
  const colors = useThemeColors();
  const { entitlement, recordPlusInterest } = useEntitlement();
  const { data } = useOnboarding();
  const [saved, setSaved] = useState(false);
  const featureCopy = feature ? FEATURE_COPY[feature] : undefined;
  const featureLine = feature ? FEATURE_VALUE_LINE[feature] : undefined;
  const valueLines = featureLine
    ? [featureLine, ...VALUE.filter((line) => line !== featureLine)]
    : [...VALUE];

  useEffect(() => {
    track("paywall_viewed", { mode, feature, availability: "interest_only" });
    if (feature) track("premium_feature_locked", { feature });
  }, [feature, mode]);

  const recordInterest = () => {
    recordPlusInterest(feature);
    track("plus_interest_recorded", { mode, feature });
    setSaved(true);
  };

  return (
    <Screen contentStyle={{ paddingTop: spacing.lg }}>
      <AppText variant="title">
        {featureCopy ? featureCopy.title : "Keep your weekly progress going"}
      </AppText>
      <AppText variant="body" color={colors.textSecondary}>
        {featureCopy
          ? featureCopy.body
          : "Free includes your full first plan and first weekly comparison. Plus is for continued tracking and adaptation."}
      </AppText>

      <View style={{ gap: spacing.xs, paddingVertical: spacing.xs }}>
        {valueLines.map((line) => (
          <View
            key={line}
            style={{
              flexDirection: "row",
              gap: spacing.xs,
              alignItems: "center",
            }}
          >
            <Ionicons name="checkmark" size={16} color={colors.actionPrimary} />
            <AppText
              variant="caption"
              color={colors.textPrimary}
              style={{ flex: 1 }}
            >
              {line}
            </AppText>
          </View>
        ))}
      </View>

      <Callout tone="info" title="One plan: Pore Plus">
        <AppText variant="bodyStrong" color={colors.textPrimary}>
          Pore Plus is not on sale yet
        </AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          There is nothing to buy in this version and no price to quote. If you
          tell us you are interested, we will let you know when Plus is
          available and the App Store will show the price before anything is
          ever charged.
        </AppText>
      </Callout>

      {needsGuardianPurchaseApproval(data.age) ? (
        <Callout
          tone="info"
          icon="people-outline"
          title="A parent handles purchases"
        >
          <AppText variant="caption" color={colors.textPrimary}>
            Profile and photo consent never includes payment permission. When
            Plus goes on sale, a parent or guardian must take the checkout
            action for anyone under 18, and the App Store will show the price
            before approval.
          </AppText>
        </Callout>
      ) : null}

      {saved || entitlement.plusInterest ? (
        <Callout tone="success" title="Interest saved">
          <AppText variant="caption" color={colors.textPrimary}>
            No purchase was started, and you have not been charged. Your Free
            plan stays active.
          </AppText>
        </Callout>
      ) : (
        <View style={{ gap: spacing.xs }}>
          <PrimaryButton
            label="I'm interested in Plus"
            onPress={recordInterest}
          />
          <AppText
            variant="caption"
            color={colors.textSecondary}
            style={{ textAlign: "center" }}
          >
            Saving interest does not start a trial or purchase.
          </AppText>
        </View>
      )}

      {mode === "onboarding" ? (
        <View style={{ gap: spacing.xxs }}>
          <TextButton
            label="Continue with Free"
            onPress={() => {
              track("paywall_skipped", { mode, feature });
              router.replace("/(tabs)");
            }}
          />
          <AppText
            variant="caption"
            color={colors.textSecondary}
            style={{ textAlign: "center" }}
          >
            Your initial results, full routine, and first comparison stay free.
          </AppText>
        </View>
      ) : (
        <TextButton
          label="Back to Pore"
          tone={colors.textSecondary}
          onPress={() => {
            track("paywall_skipped", { mode, feature });
            router.back();
          }}
        />
      )}

      <AppText
        variant="caption"
        color={colors.textSecondary}
        style={{ textAlign: "center" }}
      >
        Pore Plus checkout is not enabled in this build. Restore and
        subscription management appear only when an App Store purchase exists.
      </AppText>
    </Screen>
  );
}
