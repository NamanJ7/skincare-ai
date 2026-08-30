/** In-memory onboarding state shared across the intake screens. */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { IntakeResponse } from "@pore/shared";
import type { PlanResult } from "@/lib/api";
import type { CapturedPhoto } from "@/lib/photos";

export type OnboardingData = Partial<IntakeResponse> & {
  parentEmail?: string;
  /** Set once a parental-consent request has been created; approval is
   *  verified server-side against this id + parentEmail before /api/plan
   *  will run for an under-18 intake. */
  parentalConsentId?: string;
  /**
   * Guided-capture photos. Base64 is held in memory only for the /api/plan
   * request; the JPEGs live in the app's document directory until deleted.
   */
  photos?: CapturedPhoto[];
  /** The generated plan (assessment + safety-clamped routine), once available. */
  plan?: PlanResult;
};

interface OnboardingContextValue {
  data: OnboardingData;
  update: (patch: OnboardingData) => void;
  reset: () => void;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<OnboardingData>({});
  const value = useMemo<OnboardingContextValue>(
    () => ({
      data,
      update: (patch) => setData((prev) => ({ ...prev, ...patch })),
      reset: () => setData({}),
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
