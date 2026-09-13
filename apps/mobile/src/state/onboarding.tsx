/**
 * Onboarding/profile state shared across the intake screens and the tabs.
 * Hydrated from AsyncStorage at bootstrap (see app/_layout.tsx); every update
 * writes through so the profile and plan survive restarts.
 */
import {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type {
  ConsentRecord,
  GuardianAuthorizationRecord,
  IntakeResponse,
  SkinGoal,
  TeenSelfConsentRecord,
} from "@pore/shared";
import type { AnalysisStatus } from "@/lib/analysis-status";
import type { PlanResult } from "@/lib/api";
import { nextProfileRevision } from "@/lib/profile-revision";
import { normalizeProfile, type UserProduct } from "@/lib/profile";
import type { SafetyChoiceId } from "@/lib/questionnaire";
import { remove, save } from "@/lib/storage";

export { normalizeProfile, USER_PRODUCT_CATEGORIES } from "@/lib/profile";
export type { UserProduct, UserProductCategory } from "@/lib/profile";
export type { SafetyChoiceId } from "@/lib/questionnaire";

/** Current-routine maturity captured in the funnel (personalization only). */
export type CurrentRoutine =
  | "barely"
  | "cleanser_moisturizer"
  | "few_inconsistent"
  | "full"
  | "prescription";

/** How much routine structure the user wants Pore to recommend. */
export type RoutineComplexity = "minimal" | "balanced" | "flexible";
export type ClarityRating = 1 | 2 | 3 | 4 | 5;

export type OnboardingData = Partial<IntakeResponse> & {
  /** The single concern the user chose to anchor on (a member of `goals`). */
  primaryGoal?: SkinGoal;
  /** How developed their current routine is — drives the insight + copy. */
  currentRoutine?: CurrentRoutine;
  /** Hard conservative baseline: don't layer strong actives onto prescriptions. */
  usingPrescriptionSkincare?: boolean;
  /** Friction keys (e.g. "inconsistent", "compatibility") mirrored back later. */
  painPoints?: string[];
  /** Optional hormonal/seasonal context — replaces the old "Sex" question. */
  skinChanges?: string[];
  /** Named shelf products with a rough category — display/review only for now. */
  userProducts?: UserProduct[];
  /** Free-text restrictions the safety engine can't key on; kept for reference. */
  allergyNotes?: string;
  /** Preferred routine size; forwarded as plan context without weakening safety. */
  routineComplexity?: RoutineComplexity;
  /** Explicit, versioned permission required before a camera capture route. */
  photoAnalysisConsent?: ConsentRecord;
  /** Teen-readable privacy agreement required for ages 16–17. */
  teenSelfConsent?: TeenSelfConsentRecord;
  /** Parent authorization + device PIN credential required for ages 13–15. */
  guardianAuthorization?: GuardianAuthorizationRecord;
  /** Optional first-plan clarity score; never blocks entry to the routine. */
  clarityRating?: ClarityRating;
  /**
   * UI echoes of screens whose options map many-to-one onto engine values,
   * so editing from the review step restores the exact original selection.
   */
  goalChoiceIds?: string[];
  skinTypeChoiceId?: string;
  sensitivityChoiceId?: string;
  /** Explicit top-level safety selections; `none` is mutually exclusive. */
  safetyChoiceIds?: SafetyChoiceId[];
  /** The generated plan (assessment + safety-clamped routine), once available. */
  plan?: PlanResult;
  /** Monotonic revision of answers that affect assessment or routine output. */
  profileRevision?: number;
  /** Profile revision used when `plan` was generated. */
  planProfileRevision?: number;
  /**
   * Whether the *current* attempt produced a valid scan analysis, or fell back
   * to an answer-based read (and why). The one gate for scan-derived UI — see
   * `isCurrentScanAnalysis`. Absent on legacy profiles (treated as scan-analyzed
   * when a plan + scannedAt are present).
   */
  analysisStatus?: AnalysisStatus;
  /** Set after the local plan preview; returning users skip the funnel entirely. */
  onboardingComplete?: boolean;
  /** ISO timestamp of the last *successful* scan analysis. */
  scannedAt?: string;
  remindersOptIn?: boolean;
};

interface OnboardingContextValue {
  data: OnboardingData;
  /** Resolves false when the profile could not be persisted on this device. */
  update: (patch: OnboardingData) => Promise<boolean>;
  /** Resolves false when the persisted profile could not be removed. */
  reset: () => Promise<boolean>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

export function OnboardingProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: OnboardingData;
}) {
  // Hydrated profiles may come from older app builds; normalize on the way in.
  const [data, setData] = useState<OnboardingData>(() => normalizeProfile(initial));
  const dataRef = useRef(data);
  const value = useMemo<OnboardingContextValue>(
    () => ({
      data,
      update: (patch) => {
        // A ref keeps rapid sequential updates composable while still giving
        // terminal flows an observable persistence result to await.
        const prev = dataRef.current;
        const revision = nextProfileRevision(prev, patch);
        const next = {
          ...prev,
          ...patch,
          ...(revision !== (prev.profileRevision ?? 0)
            ? { profileRevision: revision }
            : {}),
        };
        dataRef.current = next;
        setData(next);
        return save("profile", next).then((persisted) => {
          // Keep critical route gates honest when storage fails. Only roll
          // back if no newer update has superseded this snapshot.
          if (!persisted && dataRef.current === next) {
            dataRef.current = prev;
            setData(prev);
          }
          return persisted;
        });
      },
      reset: () => {
        const prev = dataRef.current;
        const cleared: OnboardingData = {};
        dataRef.current = cleared;
        setData(cleared);
        return remove("profile").then((removed) => {
          if (!removed && dataRef.current === cleared) {
            dataRef.current = prev;
            setData(prev);
          }
          return removed;
        });
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
