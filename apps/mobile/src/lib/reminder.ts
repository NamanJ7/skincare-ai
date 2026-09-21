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
 *   - Exactly one per day, at an hour the user chose, plus at most one dated
 *     reminder that another set of photos is due. Never a streak nag, never a
 *     "we miss you", never anything the user did not opt into.
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

/**
 * Stable identifiers, so each reminder can be replaced without touching the
 * other.
 *
 * `enableReminder` used to call `cancelAllScheduledNotificationsAsync`, which
 * was correct when the daily nudge was the only thing scheduled and became a
 * silent bug the moment it was not: changing the reminder hour would have
 * cancelled a pending re-capture reminder with no trace, and the user would
 * simply never hear about the photos again.
 */
const DAILY_ID = "pore-daily-routine";
const RECHECK_ID = "pore-recheck-due";

async function ensureChannel(): Promise<void> {
  // Android shows nothing useful without a channel; importance DEFAULT keeps
  // it a quiet banner rather than a heads-up interruption.
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Routine reminder",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function permitted(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  return existing.granted || (await Notifications.requestPermissionsAsync()).granted;
}

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
    if (!(await permitted())) return false;
    await ensureChannel();

    // Replace by identifier rather than add. Scheduling twice is how apps end
    // up sending two — and cancelling everything is how they drop the other one.
    await Notifications.cancelScheduledNotificationAsync(DAILY_ID);
    await Notifications.scheduleNotificationAsync({
      identifier: DAILY_ID,
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

/** Turn the daily reminder off. Safe to call when nothing is scheduled. */
export async function disableReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(DAILY_ID);
  } catch {
    // Nothing to do — the worst case is a reminder the user turns off again.
  }
}

/**
 * One dated nudge when another set of photos comes due.
 *
 * The product had no way of asking for the thing it is built around. The only
 * invitation to re-capture was a button that appeared on `/today` after roughly
 * six weeks, which meant the single action that produces a measurement was
 * discoverable only by someone who happened to open the app on the right day
 * and read to the bottom of a card.
 *
 * Same discipline as the daily reminder, for the same reason: it names no
 * active, promises no result, and does not say what the photos will show. It
 * says a set is due, and the screen it opens computes the rest fresh. A
 * notification that promised "see how much your skin improved" would be writing
 * the verdict before the measurement, which is the one thing this product
 * exists not to do.
 *
 * Scheduled once against a date rather than repeating: the next one is booked
 * when the user actually shoots, so someone who stops capturing is reminded
 * once and then left alone.
 */
export async function scheduleRecheck(due: Date): Promise<boolean> {
  try {
    // A date already past would fire immediately, which reads as a bug.
    if (due.getTime() <= Date.now()) return false;
    if (!(await permitted())) return false;
    await ensureChannel();

    await Notifications.cancelScheduledNotificationAsync(RECHECK_ID);
    await Notifications.scheduleNotificationAsync({
      identifier: RECHECK_ID,
      content: {
        title: "Time for new photos",
        body: "Another guided set is due whenever you have a minute.",
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: due,
        channelId: CHANNEL_ID,
      },
    });
    return true;
  } catch {
    return false;
  }
}

/** Cancel a pending re-capture nudge. Called when the user erases their data. */
export async function cancelRecheck(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(RECHECK_ID);
  } catch {
    // Same contract as everything else here: never fatal.
  }
}
