/**
 * Haptics, in one place.
 *
 * Two rules. Every call is fire-and-forget and swallows its own errors — a
 * device with no haptic engine, or a simulator, must never turn a tick-off into
 * a crash. And a buzz is only ever attached to something the user *did*, never
 * to something appearing on screen: haptics that fire on their own are the
 * difference between a product feeling responsive and feeling noisy.
 */
import * as Haptics from "expo-haptics";

/** Ticking a step off, or any small confirmable action. */
export function tapped(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/** Choosing one of a set — a chip, a skin-feel answer, a tone. */
export function selected(): void {
  void Haptics.selectionAsync().catch(() => {});
}

/** Finishing a session, or a capture passing the quality gate. */
export function succeeded(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** A capture rejected, or an action that could not complete. */
export function failed(): void {
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
}
