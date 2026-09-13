import type { AppStateStatus } from "react-native";

/** Camera work is allowed only while its route and host app are both visible. */
export function shouldRunCameraSession(
  requested: boolean,
  isFocused: boolean,
  appState: AppStateStatus,
): boolean {
  return requested && isFocused && appState === "active";
}
