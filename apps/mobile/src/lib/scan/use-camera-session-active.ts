import { useIsFocused } from "expo-router";
import { useEffect, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";

import { shouldRunCameraSession } from "./camera-lifecycle";

/** Tracks route focus and app foregrounding for a single camera session. */
export function useCameraSessionActive(requested: boolean): boolean {
  const isFocused = useIsFocused();
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", setAppState);
    return () => subscription.remove();
  }, []);

  return shouldRunCameraSession(requested, isFocused, appState);
}
