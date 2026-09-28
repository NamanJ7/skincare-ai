/**
 * Pure profile-shape helpers (no React/RN imports so vitest can run them).
 * The onboarding context owns the state; this module owns the product types
 * and the defensive normalization applied when hydrating stored profiles.
 */
import { ACTIVES, ageTierFor, type ActiveKey } from "@pore/shared";

import type { OnboardingData } from "@/state/onboarding";
import { sanitizeAppCopy } from "./app-copy";
import { coreQuestionnaireComplete } from "./onboarding-readiness";
import {
  normalizeSafetyChoiceIds,
  safetyChoicesFromLegacyAnswers,
} from "./questionnaire";
import {
  hasCurrentGuardianAuthorization,
  hasCurrentTeenSelfConsent,
} from "./youth-consent";

/** Simple shelf-product buckets for the "what are you using" question. */
export type UserProductCategory =
  | "cleanser"
  | "moisturizer"
  | "sunscreen"
  | "serum"
  | "toner"
  | "other";

/** A product the user typed in by name, loosely categorized. */
export interface UserProduct {
  id: string;
  /** Stable catalog identity used for the verified product thumbnail. */
  catalogId?: string;
  name: string;
  category: UserProductCategory;
  /** Actives the user tagged from the label — drives the shelf verdict. */
  actives?: ActiveKey[];
  /** User explicitly said they don't know the ingredients (vs simply untagged). */
  ingredientsUnknown?: boolean;
  /** ISO timestamp for products added from the Shelf tab. */
  addedAt?: string;
  /** ISO timestamp set when the user pauses this product from routine assignment. */
  pausedAt?: string;
}

export const USER_PRODUCT_CATEGORIES: UserProductCategory[] = [
  "cleanser",
  "moisturizer",
  "sunscreen",
  "serum",
  "toner",
  "other",
];

/**
 * Coerce a stored profile (possibly written by an older app build, so treated
 * as untrusted) into the current shape. Profiles are additive-optional, so
 * everything passes through untouched except `userProducts` — the one
 * structured field — which gets malformed entries dropped, unknown categories
 * bucketed as "other", and unknown active keys filtered out.
 */
export function normalizeProfile(data: unknown): OnboardingData {
  if (!data || typeof data !== "object") return {};
  const stored = data as OnboardingData & { parentEmail?: unknown };
  let profile: OnboardingData = stored;

  // Parent-email collection belonged to the retired 16–17 consent stub. Do
  // not keep that sensitive legacy field; current versioned records are
  // required below before a saved youth profile remains complete.
  if ("parentEmail" in stored) {
    const withoutLegacyEmail = { ...stored };
    delete withoutLegacyEmail.parentEmail;
    profile = withoutLegacyEmail;
  }
  const safetyChoiceIds =
    profile.safetyChoiceIds !== undefined
      ? normalizeSafetyChoiceIds(profile.safetyChoiceIds)
      : safetyChoicesFromLegacyAnswers(profile);
  if (safetyChoiceIds !== undefined) {
    profile = { ...profile, safetyChoiceIds };
  }
  if (profile.age !== undefined && profile.onboardingComplete) {
    const tier = ageTierFor(profile.age);
    const authorizationMissing =
      tier === "under_13" ||
      (tier === "young_teen" &&
        !hasCurrentGuardianAuthorization(
          profile.age,
          profile.guardianAuthorization,
        )) ||
      (tier === "older_teen" &&
        !hasCurrentTeenSelfConsent(profile.age, profile.teenSelfConsent));
    if (authorizationMissing) {
      profile = { ...profile, onboardingComplete: false };
    }
  }

  // Older or corrupted profiles may say they completed onboarding while
  // missing answers now required to build a truthful plan. Preserve every
  // stored answer, but resume the funnel at the first missing step instead of
  // allowing defaults to masquerade as user input.
  if (profile.onboardingComplete && !coreQuestionnaireComplete(profile)) {
    profile = { ...profile, onboardingComplete: false };
  }

  const cleanProfile = profile.plan
    ? { ...profile, plan: sanitizeAppCopy(profile.plan) }
    : profile;
  if (profile.userProducts === undefined) return cleanProfile;

  const raw: unknown[] = Array.isArray(profile.userProducts)
    ? profile.userProducts
    : [];
  const userProducts: UserProduct[] = [];
  for (const [i, entry] of raw.entries()) {
    if (!entry || typeof entry !== "object") continue;
    const {
      id,
      catalogId,
      name,
      category,
      actives,
      ingredientsUnknown,
      addedAt,
      pausedAt,
    } = entry as {
      id?: unknown;
      catalogId?: unknown;
      name?: unknown;
      category?: unknown;
      actives?: unknown;
      ingredientsUnknown?: unknown;
      addedAt?: unknown;
      pausedAt?: unknown;
    };
    if (typeof name !== "string" || !name.trim()) continue;
    const validActives = Array.isArray(actives)
      ? actives.filter(
          (a): a is ActiveKey => typeof a === "string" && a in ACTIVES,
        )
      : [];
    userProducts.push({
      id: typeof id === "string" ? id : `product-${i}`,
      ...(typeof catalogId === "string" && catalogId.trim()
        ? { catalogId: catalogId.trim() }
        : {}),
      name: name.trim(),
      category: USER_PRODUCT_CATEGORIES.includes(
        category as UserProductCategory,
      )
        ? (category as UserProductCategory)
        : "other",
      ...(validActives.length > 0 ? { actives: validActives } : {}),
      // Tagged actives win over a stale "don't know" flag.
      ...(ingredientsUnknown === true && validActives.length === 0
        ? { ingredientsUnknown: true }
        : {}),
      ...(typeof addedAt === "string" ? { addedAt } : {}),
      ...(typeof pausedAt === "string" ? { pausedAt } : {}),
    });
  }
  return { ...cleanProfile, userProducts };
}
