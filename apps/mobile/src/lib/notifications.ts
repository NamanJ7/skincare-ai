/** The sole native boundary for expo-notifications. Keep reminder policy in reminders.ts. */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import {
  ALL_REMINDER_IDENTIFIERS,
  type PermissionState,
  type ReminderRequest,
  type ReminderTrigger,
} from "./reminders";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function useLastNotificationResponse() {
  // expo-notifications throws on web ("getLastNotificationResponse is not
  // available"), which took the whole root layout down in the web preview.
  // Platform.OS is constant for the app's lifetime, so this branch is stable.
  if (Platform.OS === "web") return null;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return Notifications.useLastNotificationResponse();
}

export function clearLastNotificationResponse(): void {
  if (Platform.OS === "web") return;
  Notifications.clearLastNotificationResponseAsync().catch(() => {});
}

export async function configureNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    await Notifications.setNotificationChannelAsync("reminders", {
      name: "Routine reminders",
      description: "Gentle routine and skin check-in reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    });
  } catch {
    // Notification setup is best-effort and must never block app startup.
  }
}

function granted(status: Notifications.NotificationPermissionsStatus): boolean {
  return (
    status.granted ||
    status.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

function permissionState(status: Notifications.NotificationPermissionsStatus): PermissionState {
  if (granted(status)) return "granted";
  return status.status === Notifications.PermissionStatus.UNDETERMINED
    ? "undetermined"
    : "denied";
}

export async function getPermissionStatus(): Promise<PermissionState> {
  if (Platform.OS === "web") return "denied";
  try {
    return permissionState(await Notifications.getPermissionsAsync());
  } catch {
    return "unknown";
  }
}

export async function requestReminderPermission(): Promise<"granted" | "denied"> {
  if (Platform.OS === "web") return "denied";
  try {
    const status = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: false, allowSound: true },
    });
    return granted(status) ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

function nativeTrigger(trigger: ReminderTrigger): Notifications.NotificationTriggerInput {
  const channelId = Platform.OS === "android" ? "reminders" : undefined;
  if (trigger.type === "calendar") {
    return {
      type: Notifications.SchedulableTriggerInputTypes.CALENDAR,
      weekday: trigger.weekday,
      hour: trigger.hour,
      minute: trigger.minute,
      repeats: true,
      channelId,
    };
  }
  if (trigger.type === "weekly") {
    return {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: trigger.weekday,
      hour: trigger.hour,
      minute: trigger.minute,
      channelId,
    };
  }
  return {
    type: Notifications.SchedulableTriggerInputTypes.DAILY,
    hour: trigger.hour,
    minute: trigger.minute,
    channelId,
  };
}

/** Cancel-and-reschedule four known IDs. This is idempotent and self-heals native drift. */
async function performReconciliation(requests: ReminderRequest[]): Promise<void> {
  if (Platform.OS === "web") return;
  for (const identifier of ALL_REMINDER_IDENTIFIERS) {
    try {
      await Notifications.cancelScheduledNotificationAsync(identifier);
    } catch {
      // Keep reconciling the remaining identifiers.
    }
  }

  for (const request of requests) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: request.identifier,
        content: { ...request.content, sound: "default" },
        trigger: nativeTrigger(request.trigger),
      });
    } catch {
      // A notification failure must not interrupt the product flow.
    }
  }

  if (__DEV__) {
    Notifications.getAllScheduledNotificationsAsync()
      .then((scheduled) =>
        console.info(
          "[retention] scheduled reminders",
          scheduled
            .filter((request) => ALL_REMINDER_IDENTIFIERS.includes(request.identifier))
            .map((request) => ({ identifier: request.identifier, trigger: request.trigger })),
        ),
      )
      .catch(() => {});
  }
}

// Permission and preference updates can arrive in adjacent renders. Serializing
// keeps an older cancellation pass from racing a newer scheduling pass.
let reconciliationQueue: Promise<void> = Promise.resolve();

export function reconcileScheduled(requests: ReminderRequest[]): Promise<void> {
  reconciliationQueue = reconciliationQueue
    .then(() => performReconciliation(requests))
    .catch(() => {});
  return reconciliationQueue;
}
