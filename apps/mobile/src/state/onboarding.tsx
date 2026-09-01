/**
 * Onboarding state, hydrated from and written back to this device.
 *
 * This used to be `useState({})`, which meant every answer the safety engine
 * depends on — sensitivity, the pregnancy flag, allergies, tone — lived exactly
 * as long as the process. See `@/lib/profile` for why that was a correctness
 * problem and not just an inconvenience.
 */
import { createContext, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import type { IntakeResponse } from "@pore/shared";
import type { PlanResult } from "@/lib/api";
import type { CapturedPhoto } from "@/lib/photos";
import { readProfile, writeProfile } from "@/lib/profile";

export type OnboardingData = Partial<IntakeResponse> & {
  parentEmail?: string;
  /**
   * Guided-capture photos. Base64 is held in memory only for the /api/plan
   * request; the JPEGs live in the app's document directory until deleted, and
   * the base64 is never written to the profile.
   */
  photos?: CapturedPhoto[];
  /** The generated plan (assessment + safety-clamped routine), once available. */
  plan?: PlanResult;
  /** Set when the questionnaire completes — the marker for "has a routine to return to". */
  onboardedAt?: string;
  /** Hour of the evening reminder, 0-23. Absent means the reminder is off. */
  reminderHour?: number;
};

interface OnboardingContextValue {
  data: OnboardingData;
  update: (patch: OnboardingData) => void;
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  // Hydrate once, synchronously, before anything renders — a screen that mounts
  // against empty answers and fills in later would flash the wrong routine.
  const [data, setData] = useState<OnboardingData>(() => {
    const { version: _version, ...stored } = readProfile();
    return stored;
  });

  // The merge is done against a ref rather than inside a state updater: the
  // updater can be invoked twice under StrictMode, and persisting from inside
  // one would make a write happen as a side effect of rendering. The ref always
  // holds the newest value, so a rapid sequence of updates can't persist a
  // stale merge either.
  const latest = useRef(data);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      data,
      update: (patch) => {
        const next = { ...latest.current, ...patch };
        latest.current = next;
        writeProfile(next);
        setData(next);
      },
      reset: () => {
        latest.current = {};
        setData({});
      },
    }),
    [data],
  );
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within an OnboardingProvider");
  return ctx;
}
