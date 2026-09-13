/**
 * Project facts the legal documents need but the codebase cannot supply.
 *
 * Everything here is either a value verified against the implementation or an
 * explicitly `pending` one. Nothing is invented: a plausible-looking company
 * name or jurisdiction is worse than a visible blank, because a blank gets
 * filled in before launch and a fabrication ships.
 */

/** A value that must be supplied by a human before launch. */
export interface PendingLegalValue {
  readonly pending: true;
  /** What the reader sees until it is filled in. */
  readonly describe: string;
}

export type LegalValue = string | PendingLegalValue;

export function pending(describe: string): PendingLegalValue {
  return { pending: true, describe };
}

export function isPending(value: LegalValue): value is PendingLegalValue {
  return typeof value !== "string";
}

/**
 * Resolve a value for display. Pending values render as a bracketed marker so
 * they are impossible to mistake for finished copy in review or in production.
 */
export function legalValue(value: LegalValue): string {
  return isPending(value) ? `[To be completed before launch: ${value.describe}]` : value;
}

export interface LegalConfig {
  productName: string;
  /** Monitored support address. Real, and already used across both apps. */
  supportEmail: string;
  /** Public marketing site. Referenced as prose only, never as a tap target. */
  websiteUrl: string;
  /** Minimum age, enforced by the age gate in `age-policy.ts`. */
  minimumAge: number;
  legalEntityName: LegalValue;
  businessAddress: LegalValue;
  governingLaw: LegalValue;
  disputeVenue: LegalValue;
}

export const LEGAL_CONFIG: LegalConfig = {
  productName: "Pore",
  supportEmail: "reachporeai@gmail.com",
  websiteUrl: "https://pore.skin",
  minimumAge: 13,
  legalEntityName: pending("registered company or sole-proprietor name"),
  businessAddress: pending("registered business address"),
  governingLaw: pending("governing law, e.g. the Province of Ontario, Canada"),
  disputeVenue: pending("courts with exclusive jurisdiction over disputes"),
};

/** Keys still awaiting a human. Read by the launch checklist and by tests. */
export function pendingLegalValues(
  config: LegalConfig = LEGAL_CONFIG,
): { key: keyof LegalConfig; describe: string }[] {
  return (Object.keys(config) as (keyof LegalConfig)[])
    .filter((key) => {
      const value = config[key];
      return typeof value === "object" && value !== null && "pending" in value;
    })
    .map((key) => ({
      key,
      describe: (config[key] as PendingLegalValue).describe,
    }));
}
