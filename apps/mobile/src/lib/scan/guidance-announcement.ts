export const GUIDANCE_ANNOUNCEMENT_INTERVAL_MS = 1800;

interface AccessibilityAnnouncer {
  announceForAccessibility?: (message: string) => void;
  announceForAccessibilityWithOptions?: (
    message: string,
    options: { queue: boolean; priority: "default" | "low" },
  ) => void;
}

/**
 * React Native Web does not implement the iOS options-based announcer. Keep
 * the richer native call when it exists, fall back to the basic API on other
 * platforms, and otherwise let the rendered live region handle the message.
 */
export function announceGuidanceMessage(
  accessibility: AccessibilityAnnouncer,
  message: string,
  countdown: boolean,
): boolean {
  if (
    typeof accessibility.announceForAccessibilityWithOptions === "function"
  ) {
    accessibility.announceForAccessibilityWithOptions(message, {
      queue: !countdown,
      priority: countdown ? "default" : "low",
    });
    return true;
  }

  if (typeof accessibility.announceForAccessibility === "function") {
    accessibility.announceForAccessibility(message);
    return true;
  }

  return false;
}

/** Maps rapidly changing camera state to one short screen-reader message. */
export function guidanceAnnouncementText(
  active: boolean,
  instruction: string | null,
  countdown: number | null,
): string | null {
  if (!active) return null;
  if (countdown != null && Number.isFinite(countdown)) {
    return `Photo in ${Math.max(1, Math.round(countdown))}`;
  }
  const normalized = instruction?.replace(/\s+/g, " ").trim();
  return normalized || null;
}

/** Countdown changes are timely; ordinary guidance is deduplicated and paced. */
export function shouldAnnounceGuidance(
  next: string | null,
  previous: string | null,
  elapsedMs: number,
  countdown: boolean,
): boolean {
  if (!next || next === previous) return false;
  return countdown || previous == null || elapsedMs >= GUIDANCE_ANNOUNCEMENT_INTERVAL_MS;
}
