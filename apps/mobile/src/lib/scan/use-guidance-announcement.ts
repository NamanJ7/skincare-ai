import { useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo } from "react-native";

import {
  GUIDANCE_ANNOUNCEMENT_INTERVAL_MS,
  announceGuidanceMessage,
  guidanceAnnouncementText,
  shouldAnnounceGuidance,
} from "./guidance-announcement";

interface AnnouncementState {
  message: string | null;
  at: number;
}

export function useGuidanceAnnouncement(options: {
  active: boolean;
  instruction: string | null;
  countdown: number | null;
}): void {
  const { active, instruction, countdown } = options;
  const [screenReaderEnabled, setScreenReaderEnabled] = useState(false);
  const last = useRef<AnnouncementState>({ message: null, at: 0 });
  const message = useMemo(
    () => guidanceAnnouncementText(active, instruction, countdown),
    [active, countdown, instruction],
  );

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
      if (mounted) setScreenReaderEnabled(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      "screenReaderChanged",
      setScreenReaderEnabled,
    );
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (!active) {
      last.current = { message: null, at: 0 };
      return;
    }
    if (!screenReaderEnabled || !message) return;

    const countdownMessage = countdown != null;
    const now = Date.now();
    const elapsed = now - last.current.at;
    const announce = () => {
      announceGuidanceMessage(AccessibilityInfo, message, countdownMessage);
      last.current = { message, at: Date.now() };
    };

    if (shouldAnnounceGuidance(message, last.current.message, elapsed, countdownMessage)) {
      announce();
      return;
    }
    if (message === last.current.message) return;

    const timer = setTimeout(
      announce,
      Math.max(0, GUIDANCE_ANNOUNCEMENT_INTERVAL_MS - elapsed),
    );
    return () => clearTimeout(timer);
  }, [active, countdown, message, screenReaderEnabled]);
}
