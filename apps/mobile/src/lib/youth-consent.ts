import {
  CONSENT_VERSION,
  YOUTH_AUTHORIZATION_VERSION,
  ageTierFor,
  type GuardianAuthorizationRecord,
  type GuardianCredential,
  type TeenSelfConsentRecord,
  type YouthDataPurpose,
} from "@pore/shared";

const REQUIRED_YOUTH_PURPOSES: readonly YouthDataPurpose[] = [
  "profile_personalization",
  "skin_photo_analysis",
  "personalized_routine",
  "progress_comparison",
];

export function createTeenSelfConsent(
  age: number,
  acceptedAt = new Date().toISOString(),
): TeenSelfConsentRecord {
  if (ageTierFor(age) !== "older_teen") {
    throw new Error("Teen self-consent is only available for ages 16–17.");
  }
  return {
    version: YOUTH_AUTHORIZATION_VERSION,
    ageAtConsent: age,
    purposes: [...REQUIRED_YOUTH_PURPOSES],
    privacyNoticeVersion: CONSENT_VERSION,
    separatePhotoConsentRequired: true,
    acceptedAt,
  };
}

export function createGuardianAuthorization(
  age: number,
  guardianCredential: GuardianCredential,
  acceptedAt = new Date().toISOString(),
): GuardianAuthorizationRecord {
  if (ageTierFor(age) !== "young_teen") {
    throw new Error("Guardian profile authorization is only used for ages 13–15.");
  }
  return {
    version: YOUTH_AUTHORIZATION_VERSION,
    ageAtAuthorization: age,
    purposes: [...REQUIRED_YOUTH_PURPOSES],
    privacyNoticeVersion: CONSENT_VERSION,
    verificationMethod: "adult_attestation_with_device_pin",
    adultAttestation: true,
    guardianCredential,
    separatePhotoAssentRequired: true,
    acceptedAt,
  };
}

export function hasCurrentTeenSelfConsent(
  age: number | undefined,
  record: TeenSelfConsentRecord | undefined,
): boolean {
  return (
    age !== undefined &&
    ageTierFor(age) === "older_teen" &&
    record?.version === YOUTH_AUTHORIZATION_VERSION &&
    ageTierFor(record.ageAtConsent) === "older_teen" &&
    record.privacyNoticeVersion === CONSENT_VERSION &&
    record.separatePhotoConsentRequired === true &&
    !record.withdrawnAt &&
    REQUIRED_YOUTH_PURPOSES.every((purpose) =>
      record.purposes.includes(purpose),
    )
  );
}

export function hasCurrentGuardianAuthorization(
  age: number | undefined,
  record: GuardianAuthorizationRecord | undefined,
): boolean {
  return (
    age !== undefined &&
    ageTierFor(age) === "young_teen" &&
    record?.version === YOUTH_AUTHORIZATION_VERSION &&
    ageTierFor(record.ageAtAuthorization) === "young_teen" &&
    record.privacyNoticeVersion === CONSENT_VERSION &&
    record.verificationMethod === "adult_attestation_with_device_pin" &&
    record.adultAttestation === true &&
    record.separatePhotoAssentRequired === true &&
    !record.withdrawnAt &&
    record.guardianCredential.algorithm === "sha256" &&
    record.guardianCredential.salt.length > 0 &&
    record.guardianCredential.digest.length > 0 &&
    REQUIRED_YOUTH_PURPOSES.every((purpose) =>
      record.purposes.includes(purpose),
    )
  );
}

export type ProfileAuthorizationRequirement =
  | "age"
  | "under_13"
  | "guardian"
  | "teen"
  | null;

export function profileAuthorizationRequirement(
  age: number | undefined,
  guardian: GuardianAuthorizationRecord | undefined,
  teen: TeenSelfConsentRecord | undefined,
): ProfileAuthorizationRequirement {
  if (age === undefined) return "age";
  const tier = ageTierFor(age);
  if (tier === "under_13") return "under_13";
  if (tier === "young_teen" && !hasCurrentGuardianAuthorization(age, guardian)) {
    return "guardian";
  }
  if (tier === "older_teen" && !hasCurrentTeenSelfConsent(age, teen)) {
    return "teen";
  }
  return null;
}
