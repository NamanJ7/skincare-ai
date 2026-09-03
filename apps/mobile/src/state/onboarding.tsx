/**
 * Onboarding state, held in memory and mirrored to the journal on disk.
 *
 * This used to be a plain `useState({})`, which meant nothing the user told
 * Pore survived the app being closed. That was not just an inconvenience: with
 * the answers gone, `buildIntake` fills defaults — including
 * `pregnancyOrBreastfeeding: false` — so the safety engine's pregnancy filter
 * silently stopped applying to someone who had said they were pregnant. State
 * that a safety rule reads is state that has to be durable.
 *
 * Photos are the deliberate exception. They stay in memory here and as JPEGs on
 * disk; see `PersistedIntake` in lib/journal.ts for why the base64 never goes
 * into the journal.
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { IntakeResponse } from "@pore/shared";
import type { PlanResult } from "@/lib/api";
import { readJournal, saveOnboarding } from "@/lib/journal";
import type { CapturedPhoto } from "@/lib/photos";

export type OnboardingData = Partial<IntakeResponse> & {
  parentEmail?: string;
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

/** Rehydrate from disk once, at mount. Reads are synchronous, so no loading state. */
function hydrate(): OnboardingData {
  const journal = readJournal();
  return { ...journal.intake, ...(journal.plan ? { plan: journal.plan } : {}) };
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<OnboardingData>(hydrate);

  // The write lives inside the updater so batched updates can't lose one to a
  // stale closure. Under StrictMode that means the same content is written
  // twice in development; the write is idempotent and best-effort, which is a
  // better trade than dropping an answer.
  const update = useCallback((patch: OnboardingData) => {
    setData((prev) => {
      const next = { ...prev, ...patch };
      saveOnboarding(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => setData({}), []);

  const value = useMemo<OnboardingContextValue>(
    () => ({ data, update, reset }),
    [data, update, reset],
  );
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding(): OnboardingContextValue {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error("useOnboarding must be used within an OnboardingProvider");
  return ctx;
}
