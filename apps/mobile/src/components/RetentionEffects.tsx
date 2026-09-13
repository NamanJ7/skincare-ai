/** Headless retention subscriber: permission refresh, schedule reconciliation, and tap routing. */
import { router, useRootNavigationState } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, Platform } from "react-native";

import { track } from "@/lib/analytics";
import {
  clearLastNotificationResponse,
  configureNotificationChannel,
  reconcileScheduled,
  useLastNotificationResponse,
} from "@/lib/notifications";
import { effectiveReminders, parseReminderTap, reminderHref } from "@/lib/reminders";
import { useReminders } from "@/state/reminders";

export function RetentionEffects() {
  const { prefs, permission, refreshPermission } = useReminders();
  const response = useLastNotificationResponse();
  const rootState = useRootNavigationState();
  const handledResponse = useRef<string | undefined>(undefined);

  useEffect(() => {
    void configureNotificationChannel();
    void refreshPermission();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshPermission();
    });
    return () => subscription.remove();
  }, [refreshPermission]);

  useEffect(() => {
    const platform = Platform.OS === "android" ? "android" : "ios";
    void reconcileScheduled(effectiveReminders(prefs, permission === "granted", platform));
  }, [permission, prefs]);

  useEffect(() => {
    if (!response || !rootState?.key) return;
    const request = response.notification.request;
    const responseKey = `${request.identifier}:${response.notification.date}:${response.actionIdentifier}`;
    if (handledResponse.current === responseKey) return;

    const type = parseReminderTap(request.content.data);
    if (!type) return;
    handledResponse.current = responseKey;
    clearLastNotificationResponse();
    track("reminder_opened", { type });
    router.push(reminderHref(type));
  }, [response, rootState?.key]);

  return null;
}
