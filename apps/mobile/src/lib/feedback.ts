/**
 * Physical feedback for the one action the user performs every day.
 *
 * Ticking off a step was previously a 0.6 opacity flash and nothing else. In a
 * habit app that single moment is most of what "premium" means — it is the only
 * thing the user does, and it should feel like it registered.
 *
 * Everything here is best-effort and fire-and-forget. Haptics are unavailable on
 * web (the platform the app is bundle-verified against) and on devices without a
 * taptic engine, and a missing buzz must never interrupt a session or surface an
 * error. Callers do not await these.
 */
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const supported = Platform.OS === "ios" || Platform.OS === "android";

/** One step ticked off. Light — this fires many times per session. */
export function tapped(): void {
  if (!supported) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
}

/**
 * The last step of a session. Distinct from `tapped` on purpose: finishing
 * should not feel like the fourth tap, it should feel like an ending.
 */
export function completed(): void {
  if (!supported) return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
}

/** A choice registered — the skin check-in. Softer than a step. */
export function selected(): void {
  if (!supported) return;
  void Haptics.selectionAsync().catch(() => {});
}
