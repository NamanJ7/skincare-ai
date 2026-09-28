/** Guided scan launcher with explicit capability and limitation copy. */
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";

import type { ThemeColors } from "@pore/shared";

import { Disclaimer } from "@/components/Disclaimer";
import { UpsellCallout } from "@/components/UpsellCallout";
import { photoPrivacyLine } from "@/lib/analysis-status";
import { scanAccess } from "@/lib/gate";
import { scanEntryHref } from "@/lib/nav";
import { buildResults } from "@/lib/results";
import { useEntitlement } from "@/state/entitlement";
import { useOnboarding } from "@/state/onboarding";
import { useScanHistory } from "@/state/scan-history";
import {
  AppText,
  Callout,
  Enter,
  NavRow,
  PrimaryButton,
  Screen,
  SectionHeader,
  iconSize,
  spacing,
  useThemeColors,
} from "@/theme";

export default function ScanTab() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { data } = useOnboarding();
  const { entitlement } = useEntitlement();
  const { history } = useScanHistory();

  const lastScan = data.scannedAt ? new Date(data.scannedAt) : null;
  const view = useMemo(() => buildResults(data, colors), [colors, data]);
  const topConcern = view.priorities[0]?.title;
  const access = scanAccess(entitlement, data, history);

  return (
    <Screen contentStyle={styles.screen}>
      <Enter index={0} style={styles.heading}>
        <AppText variant="titleSans">Scan</AppText>
        <AppText variant="body" color={colors.textSecondary}>
          Take front, right, and left photos with specific capture guidance.
        </AppText>
      </Enter>

      <Enter index={1} style={styles.capabilities}>
        <View style={styles.capabilityRow}>
          <Ionicons
            name="checkmark-circle-outline"
            size={iconSize.lg}
            color={colors.success}
          />
          <View style={styles.capabilityCopy}>
            <AppText variant="bodyStrong">What Pore can do</AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              Check implemented photo-quality signals and, when analysis is
              available, describe cosmetic appearance patterns.
            </AppText>
          </View>
        </View>
        <View style={styles.capabilityDivider} />
        <View style={styles.capabilityRow}>
          <Ionicons
            name="remove-circle-outline"
            size={iconSize.lg}
            color={colors.warning}
          />
          <View style={styles.capabilityCopy}>
            <AppText variant="bodyStrong">What Pore cannot do</AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              Diagnose a condition, replace professional care, or prove that a
              product caused a visible change.
            </AppText>
          </View>
        </View>
      </Enter>

      <Enter index={2} style={styles.scanStatus}>
        <AppText variant="overline" color={colors.textSecondary}>
          {lastScan ? "LAST ANALYZED SCAN" : "YOUR BASELINE"}
        </AppText>
        <AppText variant="bodyStrong">
          {lastScan
            ? lastScan.toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            : "No analyzed scan yet"}
        </AppText>
        <AppText variant="caption" color={colors.textSecondary}>
          {lastScan
            ? "Repeat scans in similar light so comparisons are easier to interpret."
            : "Until analysis succeeds, your routine stays based on your answers."}
        </AppText>
      </Enter>

      <Enter index={3}>
        {access.allowed ? (
          <View style={styles.primaryAction}>
            <PrimaryButton
              label={
                access.reason === "first_weekly_comparison"
                  ? "Take my free weekly comparison"
                  : lastScan
                    ? "Start my weekly scan"
                    : "Start my first scan"
              }
              onPress={() => router.push(scanEntryHref(data, "rescan"))}
            />
            <AppText
              variant="caption"
              color={colors.textSecondary}
              style={styles.center}
            >
              The shutter unlocks only after the current frame passes the
              implemented live checks.
            </AppText>
            <AppText
              variant="caption"
              color={colors.textSecondary}
              style={styles.center}
            >
              {photoPrivacyLine()}
            </AppText>
          </View>
        ) : access.reason === "cadence_wait" ? (
          <Callout tone="info" title="Your next scan is not due yet">
            <AppText variant="caption" color={colors.textPrimary}>
              It opens in {access.daysUntilAvailable}{" "}
              {access.daysUntilAvailable === 1 ? "day" : "days"}. Weekly spacing
              helps avoid reading ordinary day-to-day variation as meaningful
              change.
            </AppText>
          </Callout>
        ) : (
          <UpsellCallout feature="rescan" />
        )}
      </Enter>

      <Enter index={4}>
        <SectionHeader title="Latest read" />
        <NavRow
          titleVariant="headline"
          title={view.source === "scan" ? "Skin observations" : "Focus areas"}
          body={
            view.source === "scan"
              ? topConcern
                ? `The current read leads with ${topConcern.toLowerCase()}.`
                : "Open the current cosmetic appearance read."
              : topConcern
                ? `Based on your answers, the plan focuses on ${topConcern.toLowerCase()}.`
                : "Your current plan is based on your answers."
          }
          detail={
            view.source === "scan"
              ? "Current scan evidence"
              : "No current scan evidence"
          }
          accessibilityLabel={
            view.source === "scan"
              ? "Open latest skin analysis"
              : "Open answer-based focus areas"
          }
          onPress={() => router.push("/results")}
        />
      </Enter>

      <Disclaimer />
    </Screen>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    screen: { paddingTop: spacing.lg, gap: spacing.xl },
    heading: { gap: spacing.xs },
    capabilities: {
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    capabilityRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    capabilityCopy: { flex: 1, gap: spacing.xxs },
    capabilityDivider: { height: 1, backgroundColor: colors.border },
    scanStatus: { gap: spacing.xxs },
    primaryAction: { gap: spacing.xs },
    center: { textAlign: "center" },
  });
}
