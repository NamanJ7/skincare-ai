/** Reminder preferences modal: free defaults and Plus customization. */
import Ionicons from "@expo/vector-icons/Ionicons";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Switch, View } from "react-native";

import { track } from "@/lib/analytics";
import { openAppSettings } from "@/lib/external-links";
import { closeTo } from "@/lib/nav";
import { isPremium } from "@/lib/gate";
import { requestReminderPermission } from "@/lib/notifications";
import {
  REMINDER_TYPES,
  WEEKDAY_LABELS,
  formatReminderTime,
  type ReminderType,
} from "@/lib/reminders";
import { useEntitlement } from "@/state/entitlement";
import { useReminders } from "@/state/reminders";
import {
  AppText,
  Callout,
  Card,
  Chip,
  Divider,
  ListRow,
  Screen,
  SectionHeader,
  TextButton,
  spacing,
  useThemeColors,
} from "@/theme";

const HOURS: Record<ReminderType, number[]> = {
  am: [6, 7, 8, 9, 10],
  pm: [19, 20, 21, 22, 23],
  weekly: [16, 17, 18, 19, 20],
  sunscreen: [11, 12, 13, 14],
};

const LABELS: Record<ReminderType, { title: string; icon: keyof typeof Ionicons.glyphMap }> = {
  am: { title: "Morning routine", icon: "sunny-outline" },
  pm: { title: "Evening routine", icon: "moon-outline" },
  weekly: { title: "Weekly check-in", icon: "calendar-outline" },
  sunscreen: { title: "Sunscreen reapplication", icon: "partly-sunny-outline" },
};

export default function RemindersScreen() {
  const colors = useThemeColors();
  const { entitlement } = useEntitlement();
  const {
    prefs,
    permission,
    setOptIn,
    setTypeEnabled,
    setTime,
    setWeeklyDay,
    refreshPermission,
  } = useReminders();
  const [requesting, setRequesting] = useState(false);
  const premium = isPremium(entitlement);

  const openPaywall = () => {
    track("premium_feature_locked", { feature: "reminders", source: "reminders" });
    router.push("/paywall?feature=reminders");
  };

  const requestPermission = async () => {
    if (requesting) return;
    setRequesting(true);
    track("reminder_permission_requested", { source: "settings" });
    const result = await requestReminderPermission();
    await refreshPermission();
    if (result === "granted") {
      setOptIn(true);
      track("reminder_permission_granted", { source: "settings" });
      for (const type of REMINDER_TYPES) {
        if (!prefs[type].enabled) continue;
        track("reminder_scheduled", {
          source: "settings",
          type,
          hour: prefs[type].hour,
          minute: prefs[type].minute,
          weekday: type === "weekly" ? prefs.weekly.weekday : undefined,
        });
      }
    } else {
      setOptIn(false);
      track("reminder_permission_denied", { source: "settings" });
    }
    setRequesting(false);
  };

  const toggle = (type: ReminderType, enabled: boolean) => {
    if (type === "sunscreen" && !premium) {
      openPaywall();
      return;
    }
    setTypeEnabled(type, enabled);
    if (enabled) {
      track("reminder_scheduled", {
        source: "settings",
        type,
        hour: prefs[type].hour,
        minute: prefs[type].minute,
        weekday: type === "weekly" ? prefs.weekly.weekday : undefined,
      });
    } else {
      track("reminder_disabled", { source: "settings", type });
    }
  };

  const chooseHour = (type: ReminderType, hour: number) => {
    if (!premium) {
      openPaywall();
      return;
    }
    setTime(type, hour, 0);
    track("reminder_scheduled", {
      source: "settings",
      type,
      hour,
      minute: 0,
      weekday: type === "weekly" ? prefs.weekly.weekday : undefined,
    });
  };

  const chooseWeekday = (weekday: number) => {
    if (!premium) {
      openPaywall();
      return;
    }
    setWeeklyDay(weekday);
    track("reminder_scheduled", {
      source: "settings",
      type: "weekly",
      hour: prefs.weekly.hour,
      minute: prefs.weekly.minute,
      weekday,
    });
  };

  return (
    <Screen contentStyle={{ paddingTop: spacing.lg }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={{ flex: 1, gap: spacing.xxs }}>
          <AppText variant="titleSans">Reminders</AppText>
          <AppText variant="caption" color={colors.textSecondary}>
            Gentle nudges for your routine.
          </AppText>
        </View>
        <Pressable
          onPress={() => closeTo()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Close reminders"
        >
          <Ionicons name="close" size={24} color={colors.textSecondary} />
        </Pressable>
      </View>

      {permission === "denied" ? (
        <Callout tone="caution" title="Notifications are off in iOS Settings">
          <AppText variant="caption" color={colors.textPrimary}>
            Allow notifications in Settings to start reminders.
          </AppText>
          <TextButton
            label="Open Settings"
            onPress={() => void openAppSettings()}
          />
        </Callout>
      ) : permission === "undetermined" ? (
        <Callout tone="info" title="Allow Pore to send reminders">
          <AppText variant="caption" color={colors.textPrimary}>
            Pore only asks when you turn them on.
          </AppText>
          <TextButton
            label={requesting ? "Requesting…" : "Allow notifications"}
            onPress={() => void requestPermission()}
          />
        </Callout>
      ) : null}

      {!premium ? (
        <Callout tone="info" title="Your default reminders stay free">
          <AppText variant="caption" color={colors.textPrimary}>
            Plus unlocks custom times and sunscreen reminders.
          </AppText>
        </Callout>
      ) : null}

      {REMINDER_TYPES.map((type) => {
        const pref = prefs[type];
        const active = prefs.optIn && pref.enabled;
        const sunscreenLocked = type === "sunscreen" && !premium;
        return (
          <View key={type}>
            <SectionHeader title={LABELS[type].title} />
            <Card style={{ gap: 0, paddingVertical: spacing.xs }}>
              <ListRow
                icon={LABELS[type].icon}
                label={active ? "On" : "Off"}
                detail={formatReminderTime(pref.hour, pref.minute)}
                badge={sunscreenLocked ? "PLUS" : undefined}
                onPress={
                  sunscreenLocked ? () => toggle(type, !active) : undefined
                }
                trailing={
                  sunscreenLocked ? (
                    "none"
                  ) : (
                    <Switch
                      value={active}
                      onValueChange={(enabled) => toggle(type, enabled)}
                      trackColor={{ false: colors.border, true: colors.brandAccent }}
                      thumbColor={active ? colors.actionPrimary : colors.surface}
                      accessibilityLabel={`${LABELS[type].title} reminder, ${active ? "on" : "off"}`}
                      accessibilityHint={
                        active
                          ? "Turns this reminder off"
                          : "Turns this reminder on"
                      }
                    />
                  )
                }
              />

              {active ? (
                <>
                  <Divider />
                  <View style={{ gap: spacing.sm, paddingVertical: spacing.md }}>
                    <AppText variant="overline" color={colors.textSecondary}>
                      TIME {premium ? "" : "· PLUS"}
                    </AppText>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                      {HOURS[type].map((hour) => (
                        <Chip
                          key={hour}
                          label={formatReminderTime(hour, 0)}
                          selected={pref.hour === hour}
                          onPress={() => chooseHour(type, hour)}
                        />
                      ))}
                    </View>

                    {type === "weekly" ? (
                      <>
                        <AppText variant="overline" color={colors.textSecondary}>
                          DAY {premium ? "" : "· PLUS"}
                        </AppText>
                        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.sm }}>
                          {Array.from({ length: 7 }, (_, index) => index + 1).map((weekday) => (
                            <Chip
                              key={weekday}
                              label={WEEKDAY_LABELS[weekday] ?? ""}
                              selected={prefs.weekly.weekday === weekday}
                              onPress={() => chooseWeekday(weekday)}
                            />
                          ))}
                        </View>
                      </>
                    ) : null}
                  </View>
                </>
              ) : null}
            </Card>
          </View>
        );
      })}
    </Screen>
  );
}
