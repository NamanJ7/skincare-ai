/**
 * Confirmations and notices that actually appear on every platform this app
 * builds for.
 *
 * `Alert` in react-native-web is `class Alert { static alert() {} }` — a
 * literal no-op. Every `Alert.alert` call therefore vanished on the web build,
 * which is the surface the app is reviewed on: "Delete my data", "Retake
 * questionnaire", "Sign out" and every failure notice looked like dead buttons
 * there while working correctly on device. Routing them through here keeps one
 * behaviour on iOS and Android and gives web a real dialog instead of silence.
 *
 * Native keeps `Alert.alert` verbatim, including `destructive`/`cancel` styling,
 * so nothing about the on-device experience changes.
 */
import { Alert, Platform } from "react-native";

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Label for the affirmative action. */
  confirmLabel: string;
  cancelLabel?: string;
  /** Renders the affirmative action in the destructive style on native. */
  destructive?: boolean;
}

/** True when the reader confirmed, false when they cancelled or dismissed. */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  const { title, message, confirmLabel, cancelLabel = "Cancel", destructive } = options;

  if (Platform.OS === "web") {
    // `window.confirm` cannot render custom button labels, so the labels go
    // into the body text rather than being dropped silently.
    const body = [message, `OK = ${confirmLabel} · Cancel = ${cancelLabel}`]
      .filter(Boolean)
      .join("\n\n");
    return Promise.resolve(webConfirm(`${title}\n\n${body}`));
  }

  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: cancelLabel, style: "cancel", onPress: () => resolve(false) },
      {
        text: confirmLabel,
        style: destructive ? "destructive" : "default",
        onPress: () => resolve(true),
      },
    ]);
  });
}

/** A one-way notice: something succeeded, failed, or needs explaining. */
export function notify(title: string, message?: string): void {
  if (Platform.OS === "web") {
    webAlert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

function webConfirm(text: string): boolean {
  if (typeof globalThis.confirm !== "function") return false;
  return globalThis.confirm(text);
}

function webAlert(text: string): void {
  if (typeof globalThis.alert !== "function") return;
  globalThis.alert(text);
}
