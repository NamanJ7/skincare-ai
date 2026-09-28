import Ionicons from "@expo/vector-icons/Ionicons";
import {
  Redirect,
  router,
  useLocalSearchParams,
  type Href,
} from "expo-router";
import { useEffect, useRef, useState } from "react";
import { View } from "react-native";

import { FunnelScreen } from "@/components/FunnelScreen";
import { isCurrentScanAnalysis } from "@/lib/analysis-status";
import { track } from "@/lib/analytics";
import { activePeriod } from "@/lib/daily-action";
import { funnelProgress } from "@/lib/funnel-progress";
import { nextRequiredOnboardingHref } from "@/lib/onboarding-flow";
import { requestReminderPermission } from "@/lib/notifications";
import { useOnboarding } from "@/state/onboarding";
import { useReminders } from "@/state/reminders";
import { AppText, Callout, iconSize, spacing, useThemeColors } from "@/theme";

export default function NotificationChoice() {
  const { data } = useOnboarding();
  const required = nextRequiredOnboardingHref(data);
  if (required) return <Redirect href={required as Href} />;
  return <NotificationChoiceContent />;
}

function NotificationChoiceContent() {
  const colors = useThemeColors();
  const { period: rawPeriod } = useLocalSearchParams<{ period?: string }>();
  const period =
    rawPeriod === "am" || rawPeriod === "pm"
      ? rawPeriod
      : activePeriod(new Date().getHours(), false);
  const { data, update } = useOnboarding();
  const { setOptIn, refreshPermission } = useReminders();
  const [requesting, setRequesting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const requestInFlight = useRef(false);
  const finishInFlight = useRef(false);
  const [errorTitle, setErrorTitle] = useState("Notifications were not enabled");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    track("onboarding_step_viewed", { step_id: "notifications" });
    track("notification_prompt_viewed", { source: "onboarding" });
  }, []);

  const finish = async (enabled: boolean) => {
    if (finishInFlight.current || requestInFlight.current) return;
    finishInFlight.current = true;
    setFinishing(true);
    setError(null);

    const persisted = await update({
      remindersOptIn: enabled,
      onboardingComplete: true,
    });
    if (!persisted) {
      finishInFlight.current = false;
      setFinishing(false);
      setErrorTitle("Could not finish setup");
      setError(
        "Pore could not save your setup on this device. Keep the app open and tap your choice again.",
      );
      return;
    }

    setOptIn(enabled);
    track("onboarding_step_completed", { step_id: "notifications" });
    track(enabled ? "notification_opted_in" : "notification_skipped", {
      source: "onboarding",
    });
    track("onboarding_completed", {
      source: isCurrentScanAnalysis(data) ? "scan" : "answers",
      next_period: period,
      reminders: enabled,
    });
    finishInFlight.current = false;
    setFinishing(false);
    router.replace({ pathname: "/(tabs)/routine", params: { period } });
  };

  const enable = async () => {
    if (requestInFlight.current || finishInFlight.current) return;
    requestInFlight.current = true;
    setRequesting(true);
    setError(null);
    track("reminder_permission_requested", { source: "onboarding" });
    const result = await requestReminderPermission();
    await refreshPermission();
    requestInFlight.current = false;
    setRequesting(false);
    if (result === "granted") {
      track("reminder_permission_granted", { source: "onboarding" });
      await finish(true);
      return;
    }
    setErrorTitle("Notifications were not enabled");
    setError(
      "Notifications are still off. You can continue now and change this later in Profile.",
    );
    track("reminder_permission_denied", { source: "onboarding" });
  };

  return (
    <FunnelScreen
      progress={funnelProgress("notifications")}
      eyebrow="OPTIONAL REMINDERS"
      title="Would a gentle nudge help?"
      subtitle="Pore can remind you about your morning, evening, and weekly check-in. You stay in control."
      primaryLabel="Turn on reminders"
      primaryLoading={requesting || finishing}
      primaryDisabled={requesting || finishing}
      onPrimary={() => void enable()}
      secondaryLabel="Not now"
      onSecondary={() => void finish(false)}
      footnote="You can change reminder choices later from Profile."
    >
      <Callout tone="info" title="Free defaults, no marketing alerts">
        <View style={{ gap: spacing.sm }}>
          {[
            "Morning and evening routine reminders",
            "One weekly skin check-in reminder",
            "No promotional push notifications",
          ].map((item) => (
            <View
              key={item}
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.xs }}
            >
              <Ionicons
                name="checkmark-circle-outline"
                size={iconSize.md}
                color={colors.actionPrimary}
                accessible={false}
              />
              <AppText variant="caption" color={colors.textPrimary} style={{ flex: 1 }}>
                {item}
              </AppText>
            </View>
          ))}
        </View>
      </Callout>
      {error ? (
        <Callout tone="caution" title={errorTitle}>
          <AppText variant="caption" color={colors.textPrimary}>
            {error}
          </AppText>
        </Callout>
      ) : null}
    </FunnelScreen>
  );
}
