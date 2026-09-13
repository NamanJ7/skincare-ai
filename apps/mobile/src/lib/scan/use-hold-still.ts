/**
 * DeviceMotion → steady/moving signal for the capture screen. Best-effort:
 * missing hardware, denied motion permission, or a platform that never emits
 * samples (desktop web) all resolve to `null`, and the UI simply omits the
 * hint. This never claims face detection — it only knows about the phone.
 */
import { DeviceMotion } from "expo-sensors";
import { useEffect, useState } from "react";

import { isDeviceSteady, pushMotionSample, type MotionSample } from "./hold-still";

const UPDATE_INTERVAL_MS = 100;

/** `null` until motion data proves available; then live steady/moving. */
export function useHoldStill(enabled: boolean): boolean | null {
  const [steady, setSteady] = useState<boolean | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let subscription: { remove(): void } | null = null;
    let history: MotionSample[] = [];

    (async () => {
      try {
        if (!(await DeviceMotion.isAvailableAsync()) || cancelled) return;
        // Granted silently on native; only browser iOS actually prompts.
        const permission = await DeviceMotion.requestPermissionsAsync();
        if (!permission.granted || cancelled) return;

        DeviceMotion.setUpdateInterval(UPDATE_INTERVAL_MS);
        subscription = DeviceMotion.addListener((event) => {
          const rate = event.rotationRate;
          if (!rate) return;
          history = pushMotionSample(history, {
            magnitude: Math.hypot(rate.alpha ?? 0, rate.beta ?? 0, rate.gamma ?? 0),
            at: Date.now(),
          });
          const next = isDeviceSteady(history);
          setSteady((prev) => (prev === next ? prev : next));
        });
      } catch {
        // Sensor unavailable — leave `steady` null so the hint stays hidden.
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
      setSteady(null);
    };
  }, [enabled]);

  return steady;
}
