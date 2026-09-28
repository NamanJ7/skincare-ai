export const MIN_SUPPORTED_AGE = 13 as const;

export type AgeTier =
  | "under_13"
  | "young_teen"
  | "older_teen"
  | "adult";

export function ageTierFor(age: number): AgeTier {
  if (age < 13) return "under_13";
  if (age <= 15) return "young_teen";
  if (age <= 17) return "older_teen";
  return "adult";
}

export function isSupportedAge(age: number | undefined): boolean {
  return age !== undefined && age >= MIN_SUPPORTED_AGE;
}

export function needsGuardianProfileAuthorization(
  age: number | undefined,
): boolean {
  return age !== undefined && ageTierFor(age) === "young_teen";
}

export function needsTeenSelfConsent(age: number | undefined): boolean {
  return age !== undefined && ageTierFor(age) === "older_teen";
}

/**
 * Conservative launch policy: no minor starts a paid transaction without a
 * parent or guardian taking the checkout action.
 */
export function needsGuardianPurchaseApproval(
  age: number | undefined,
): boolean {
  return age !== undefined && age >= MIN_SUPPORTED_AGE && age < 18;
}
