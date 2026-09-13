import { CONSENT_VERSION, type ConsentPurpose, type ConsentRecord } from "@pore/shared";

const REQUIRED_PHOTO_PURPOSES: readonly ConsentPurpose[] = [
  "skin_photo_analysis",
  "personalized_routine",
  "progress_comparison",
];

/** Build the versioned record only after the user checks the explicit control. */
export function createPhotoAnalysisConsent(
  acceptedAt = new Date().toISOString(),
): ConsentRecord {
  return {
    version: CONSENT_VERSION,
    purposes: [...REQUIRED_PHOTO_PURPOSES],
    privacyNoticeVersion: CONSENT_VERSION,
    processorDisclosureVersion: CONSENT_VERSION,
    trainingOptIn: false,
    acceptedAt,
  };
}

/** Stale, withdrawn, malformed, or partial consent never unlocks capture. */
export function hasCurrentPhotoAnalysisConsent(
  consent: ConsentRecord | undefined,
): boolean {
  return (
    consent?.version === CONSENT_VERSION &&
    consent.trainingOptIn === false &&
    !consent.withdrawnAt &&
    REQUIRED_PHOTO_PURPOSES.every((purpose) => consent.purposes.includes(purpose))
  );
}
