/**
 * Onboarding state shared across the intake screens.
 *
 * Seeded from the plan saved on this device, so a returning user keeps their
 * routine and the answers behind it. The read is synchronous (see `loadPlan`),
 * which is what lets the landing screen decide where to send someone on its
 * first render instead of flashing a marketing page at an existing user.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { IntakeResponse } from "@pore/shared";
import type { PlanResult } from "@/lib/api";
import type { CapturedPhoto } from "@/lib/photos";
import { clearPlan, loadPlan } from "@/lib/plan";

export type OnboardingData = Partial<IntakeResponse> & {
  parentEmail?: string;
  /**
   * Guided-capture photos. Base64 is held in memory only for the /api/plan
   * request; the JPEGs live in the app's document directory until deleted.
   * Never restored from storage — the bytes are gone once the request is done.
   */
  photos?: CapturedPhoto[];
  /** The generated plan (assessment + safety-clamped routine), once available. */
  plan?: PlanResult;
};

interface OnboardingContextValue {
  data: OnboardingData;
  update: (patch: OnboardingData) => void;
  /** Clear this session AND the saved plan — the user's "start over". */
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

/** Rebuild session state from whatever this device has saved. */
function restore(): OnboardingData {
  const stored = loadPlan();
  if (!stored) return {};
  return { ...stored.intake, plan: stored.plan };
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<OnboardingData>(restore);
  const value = useMemo<OnboardingContextValue>(
    () => ({
      data,
      update: (patch) => setData((prev) => ({ ...prev, ...patch })),
      reset: () => {
        clearPlan();
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
