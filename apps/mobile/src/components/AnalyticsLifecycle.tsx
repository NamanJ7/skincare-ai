import { useEffect } from "react";
import { AppState, Platform, type AppStateStatus } from "react-native";

import { track } from "@/lib/analytics";
import { installLocalAnalyticsSink } from "@/lib/analytics-outbox";

/**
 * Persists privacy-safe beta funnel events locally until a production analytics
 * adapter is selected. A foreground transition begins a new observable session.
 */
export function AnalyticsLifecycle() {
  useEffect(() => {
    const uninstall = installLocalAnalyticsSink();
    let state: AppStateStatus = AppState.currentState;

    track("app_opened", { platform: Platform.OS });
    track("session_started", { source: "launch" });

    const subscription = AppState.addEventListener("change", (next) => {
      if (state !== "active" && next === "active") {
        track("session_started", { source: "resume" });
      }
      state = next;
    });

    return () => {
      subscription.remove();
      uninstall();
    };
  }, []);

  return null;
}
