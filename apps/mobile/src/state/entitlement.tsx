/**
 * Local Free / Plus seam. Real App Store entitlement sync is intentionally
 * deferred; this context never fabricates a purchase. It only hydrates a
 * future provider-supplied Plus state, records the free monthly compatibility
 * quota, and records honest beta interest from the paywall.
 */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  FREE_COMPATIBILITY_CHECKS_PER_MONTH,
  compatibilityMonthKey,
  type PremiumFeature,
} from "@/lib/gate";
import { remove, save } from "@/lib/storage";

export interface CompatibilityUsage {
  month: string;
  productIds: string[];
}

export interface PlusInterest {
  recordedAt: string;
  feature?: PremiumFeature;
}

export interface Entitlement {
  unlocked: boolean;
  /** Pore intentionally has one paid tier until a second has distinct value. */
  tier?: "plus";
  term?: "annual" | "monthly";
  unlockedAt?: string;
  compatibilityUsage?: CompatibilityUsage;
  plusInterest?: PlusInterest;
}

const FREE: Entitlement = { unlocked: false };

function normalizeEntitlement(initial?: Entitlement): Entitlement {
  if (!initial) return FREE;
  // Older local builds could persist a simulated `pro` tier. Preserve access
  // for that device but collapse it into the sole Plus entitlement.
  const unlocked = initial.unlocked === true;
  const usage = initial.compatibilityUsage;
  const compatibilityUsage =
    usage &&
    typeof usage.month === "string" &&
    Array.isArray(usage.productIds)
      ? {
          month: usage.month,
          productIds: Array.from(
            new Set(
              usage.productIds.filter(
                (id): id is string => typeof id === "string" && !!id,
              ),
            ),
          ).slice(0, FREE_COMPATIBILITY_CHECKS_PER_MONTH),
        }
      : undefined;
  const interest = initial.plusInterest;
  const plusInterest =
    interest && typeof interest.recordedAt === "string"
      ? {
          recordedAt: interest.recordedAt,
          ...(interest.feature &&
          ["rescan", "shelf_detail", "reminders", "weekly_report"].includes(
            interest.feature,
          )
            ? { feature: interest.feature }
            : {}),
        }
      : undefined;
  return {
    unlocked,
    ...(unlocked ? { tier: "plus" as const } : {}),
    ...(initial.term === "annual" || initial.term === "monthly"
      ? { term: initial.term }
      : {}),
    ...(typeof initial.unlockedAt === "string"
      ? { unlockedAt: initial.unlockedAt }
      : {}),
    ...(compatibilityUsage ? { compatibilityUsage } : {}),
    ...(plusInterest ? { plusInterest } : {}),
  };
}

interface EntitlementContextValue {
  entitlement: Entitlement;
  recordCompatibilityCheck: (productId: string, now?: Date) => void;
  recordPlusInterest: (feature?: PremiumFeature) => void;
  clear: () => void;
}

const EntitlementContext = createContext<EntitlementContextValue | null>(null);

export function EntitlementProvider({
  children,
  initial,
}: {
  children: ReactNode;
  initial?: Entitlement;
}) {
  const [entitlement, setEntitlement] = useState<Entitlement>(() =>
    normalizeEntitlement(initial),
  );

  const mutate = useCallback((build: (current: Entitlement) => Entitlement) => {
    setEntitlement((current) => {
      const next = build(current);
      save("entitlement", next);
      return next;
    });
  }, []);

  const value = useMemo<EntitlementContextValue>(
    () => ({
      entitlement,
      recordCompatibilityCheck: (productId, now = new Date()) =>
        mutate((current) => {
          if (current.unlocked && current.tier === "plus") return current;
          const month = compatibilityMonthKey(now);
          const productIds =
            current.compatibilityUsage?.month === month
              ? current.compatibilityUsage.productIds
              : [];
          if (productIds.includes(productId)) return current;
          if (productIds.length >= FREE_COMPATIBILITY_CHECKS_PER_MONTH)
            return current;
          return {
            ...current,
            compatibilityUsage: { month, productIds: [...productIds, productId] },
          };
        }),
      recordPlusInterest: (feature) =>
        mutate((current) => ({
          ...current,
          plusInterest: {
            recordedAt: new Date().toISOString(),
            ...(feature ? { feature } : {}),
          },
        })),
      clear: () => {
        remove("entitlement");
        setEntitlement(FREE);
      },
    }),
    [entitlement, mutate],
  );
  return (
    <EntitlementContext.Provider value={value}>
      {children}
    </EntitlementContext.Provider>
  );
}

export function useEntitlement(): EntitlementContextValue {
  const ctx = useContext(EntitlementContext);
  if (!ctx)
    throw new Error("useEntitlement must be used within an EntitlementProvider");
  return ctx;
}
