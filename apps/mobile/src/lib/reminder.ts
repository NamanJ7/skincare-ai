/**
 * The one notification Pore sends.
 *
 * `/today` answers "what do I do right now" and nothing ever asked the user to
 * come and look. A cadence engine that depends on the user remembering to open
 * the app is a plan, not a habit.
 *
 * The constraints on this are deliberate and tight, because a badly behaved
 * notification is the fastest way to get a wellness app deleted:
 *
 *   - Exactly one per day, at an hour the user chose. Never a streak nag, never
 *     a "we miss you", never anything the user did not opt into.
 *   - Local only. There is no push token, no server, and nothing leaves the
 *     device — same promise as the journal and the photos.
 *   - Turned off from `/plan`, in plain sight, next to the other data controls.
 *
 * On the body text: it deliberately does NOT name tonight's active. A daily
 * trigger is scheduled once and fires unchanged, so "Retinoid night" would be
 * wrong on the four nights a week it is not a retinoid night — and it could be
 * falsified by the user's own check-in, since reporting stinging deloads the
 * routine and renames the session. An app built around refusing to say things it
 * cannot support does not get to make an exception for a push banner. The
 * headline lives on the screen this opens, where it is computed fresh.
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

/** Evening options. Late enough to be after dinner, early enough not to be bedtime. */
export const REMINDER_HOURS = [19, 20, 21, 22] as const;

const CHANNEL_ID = "routine-reminder";

/** "9:00 pm" — for the chips and the current-setting line on /plan. */
export function formatHour(hour: number): string {
  const suffix = hour >= 12 ? "pm" : "am";
  const twelve = hour % 12 === 0 ? 12 : hour % 12;
  return `${twelve}:00 ${suffix}`;
}

/**
 * Ask for permission and schedule the reminder.
 *
 * Returns false when the user declined, so the caller can leave the setting off
 * rather than showing a reminder as enabled that will never arrive.
 */
export async function enableReminder(hour: number): Promise<boolean> {
  try {
    const existing = await Notifications.getPermissionsAsync();
    const granted =
      existing.granted || (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return false;

    // Android shows nothing useful without a channel; importance DEFAULT keeps
    // it a quiet banner rather than a heads-up interruption.
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: "Routine reminder",
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    // Replace rather than add. Scheduling twice is how apps end up sending two.
    await Notifications.cancelAllScheduledNotificationsAsync();
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Your evening routine",
        body: "Tonight's steps are ready.",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute: 0,
        channelId: CHANNEL_ID,
      },
    });
    return true;
  } catch {
    // A reminder that could not be scheduled is a missing convenience, never a
    // reason to fail the screen the user is standing on.
    return false;
  }
}

/** Turn it off. Safe to call when nothing is scheduled. */
export async function disableReminder(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // Nothing to do — the worst case is a reminder the user turns off again.
  }
}
