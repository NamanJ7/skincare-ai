/**
 * The one notification Pore sends.
 *
 * Three rules, and they are the whole design:
 *
 * 1. **Evening only.** The morning routine happens anyway — you are already at
 *    the sink. The evening one is the one that gets skipped. A second daily
 *    notification would be for us, not for the user.
 * 2. **Never guilt.** No streak language, no "don't break your run", no count
 *    of what you missed. This product's whole position is that it pulls back
 *    when your skin protests; a notification that punishes a missed night would
 *    contradict the engine underneath it.
 * 3. **Asked only once, and only after it is earned.** See `shouldOfferReminder`
 *    in the journal: we ask after a session the user actually finished, never
 *    during onboarding. On iOS you get one prompt ever, and a prompt that
 *    arrives before the product has done anything is a prompt that gets denied.
 *
 * Every call swallows its own errors. A phone with notifications disabled at
 * the OS level, or a simulator, must never turn a tick-off into a crash.
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { ReminderSetting } from "@pore/shared";

/** Marks our own scheduled notification so we never cancel someone else's. */
const IDENTIFIER_DATA = { kind: "pore-evening-routine" } as const;

const ANDROID_CHANNEL = "evening-routine";

/** 8:30pm: late enough to be after dinner, early enough not to be a bedtime nag. */
export const DEFAULT_REMINDER: ReminderSetting = { enabled: true, hour: 20, minute: 30 };

/** The times worth offering. A full picker is a dependency for no real gain. */
export const REMINDER_TIMES: { hour: number; minute: number; label: string }[] = [
  { hour: 20, minute: 0, label: "8:00 pm" },
  { hour: 20, minute: 30, label: "8:30 pm" },
  { hour: 21, minute: 30, label: "9:30 pm" },
  { hour: 22, minute: 30, label: "10:30 pm" },
];

export function reminderLabel(r: ReminderSetting): string {
  const match = REMINDER_TIMES.find((t) => t.hour === r.hour && t.minute === r.minute);
  if (match) return match.label;
  const h = r.hour % 12 === 0 ? 12 : r.hour % 12;
  return `${h}:${String(r.minute).padStart(2, "0")} ${r.hour < 12 ? "am" : "pm"}`;
}

/**
 * Show the notification even when the app is foregrounded.
 *
 * Called once at startup. `shouldShowBanner`/`shouldShowList` are the SDK 56
 * fields; the old single `shouldShowAlert` is deprecated.
 */
export function configureNotifications(): void {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });
  } catch {
    // Nothing here is worth failing a launch over.
  }
}

/** Ask the OS. Returns whether we may actually post a notification. */
export async function requestPermission(): Promise<boolean> {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    // `canAskAgain: false` means the user has denied it for good; asking again
    // is a no-op that returns the same denial, so don't pretend otherwise.
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
    return asked.granted;
  } catch {
    return false;
  }
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL, {
    name: "Evening routine",
    importance: Notifications.AndroidImportance.DEFAULT,
    // A skincare reminder that vibrates the phone is a skincare reminder that
    // gets switched off.
    vibrationPattern: undefined,
    sound: undefined,
  });
}

/** Remove any reminder we previously scheduled, leaving anything else alone. */
export async function cancelReminder(): Promise<void> {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((n) => n.content.data?.kind === IDENTIFIER_DATA.kind)
        .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
    );
  } catch {
    // Worst case a stale reminder fires once and the next sync clears it.
  }
}

/**
 * Make the scheduled state match the setting.
 *
 * Idempotent: cancels ours first, then schedules at most one. Safe to call on
 * every app focus, which is what keeps the OS in step with the journal after an
 * erase or a time change.
 */
export async function syncReminder(setting: ReminderSetting | undefined): Promise<void> {
  await cancelReminder();
  if (!setting?.enabled) return;
  try {
    if (!(await Notifications.getPermissionsAsync()).granted) return;
    await ensureAndroidChannel();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Your evening routine",
        // Deliberately plain. It says what is true every night and asks for
        // nothing — no streak, no count, no "you missed yesterday".
        body: "Tonight's steps are ready. It takes about two minutes.",
        data: IDENTIFIER_DATA,
        sound: false,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: setting.hour,
        minute: setting.minute,
        channelId: ANDROID_CHANNEL,
      },
    });
  } catch {
    // A reminder that failed to schedule is a missing convenience, not a broken
    // routine. The setting stays on and the next sync will try again.
  }
}
