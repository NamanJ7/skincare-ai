/**
 * Versioned product contracts shared by the mobile client and the eventual
 * production services. These types are intentionally transport-agnostic so
 * every client and service can enforce the same privacy rules.
 */
import type { Assessment, ConcernKey } from "./assessment";
import type { RoutineComplexity, SkinGoal, SkinType } from "./intake";
import type { ActiveKey, ProductCategory, Routine } from "./routine";

export const INTAKE_PROFILE_VERSION = 2 as const;
export const CONSENT_VERSION = "2026-07-16" as const;
export const YOUTH_AUTHORIZATION_VERSION = "2026-07-16" as const;

export type AgeBand =
  | "13_15"
  | "16_17"
  | "18_24"
  | "25_30"
  | "31_plus";
export interface RankedConcern {
  concern: SkinGoal;
  /** One is the user's highest priority. */
  rank: number;
}

export interface CurrentProductReference {
  id?: string;
  displayName?: string;
  category?: ProductCategory;
  active?: ActiveKey;
  verification: "catalog" | "user_reported";
}

export interface IntakeProfileV2 {
  version: typeof INTAKE_PROFILE_VERSION;
  ageBand: AgeBand;
  concerns: RankedConcern[];
  skinType: SkinType;
  sensitivity: "low" | "medium" | "high";
  allergies: string[];
  pregnancyOrBreastfeeding: boolean;
  usingPrescriptionSkincare: boolean;
  currentProducts: CurrentProductReference[];
  routineComplexity: RoutineComplexity;
  updatedAt: string;
}

export type ConsentPurpose =
  | "skin_photo_analysis"
  | "progress_comparison"
  | "personalized_routine";

export interface ConsentRecord {
  version: typeof CONSENT_VERSION;
  purposes: ConsentPurpose[];
  privacyNoticeVersion: string;
  processorDisclosureVersion: string;
  /** Training is never bundled into the service consent. */
  trainingOptIn: false;
  acceptedAt: string;
  withdrawnAt?: string;
}

export type YouthDataPurpose =
  | "profile_personalization"
  | "skin_photo_analysis"
  | "personalized_routine"
  | "progress_comparison";

export interface TeenSelfConsentRecord {
  version: typeof YOUTH_AUTHORIZATION_VERSION;
  ageAtConsent: number;
  purposes: YouthDataPurpose[];
  privacyNoticeVersion: typeof CONSENT_VERSION;
  /** The scan screen still asks again before any photo is captured. */
  separatePhotoConsentRequired: true;
  acceptedAt: string;
  withdrawnAt?: string;
}

export interface GuardianCredential {
  algorithm: "sha256";
  salt: string;
  digest: string;
}

export interface GuardianAuthorizationRecord {
  version: typeof YOUTH_AUTHORIZATION_VERSION;
  ageAtAuthorization: number;
  purposes: YouthDataPurpose[];
  privacyNoticeVersion: typeof CONSENT_VERSION;
  verificationMethod: "adult_attestation_with_device_pin";
  adultAttestation: true;
  guardianCredential: GuardianCredential;
  /** The young person still assents at the scan screen before capture. */
  separatePhotoAssentRequired: true;
  acceptedAt: string;
  withdrawnAt?: string;
}

export type ScanLifecycleStatus =
  | "awaiting_upload"
  | "ready"
  | "analyzing"
  | "analyzed"
  | "failed"
  | "deleting"
  | "deleted";

export interface ScanCaptureReference {
  pose: "front" | "left" | "right";
  objectKey: string;
  contentDigest: string;
  mediaType: "image/jpeg" | "image/png";
  byteLength: number;
  width: number;
  height: number;
}

export interface ScanRecordContract {
  id: string;
  ownerId: string;
  kind: "initial" | "follow_up";
  captures: ScanCaptureReference[];
  status: ScanLifecycleStatus;
  capturedAt: string;
  analyzedAt?: string;
  deleteAfter?: string;
}

export type AnalysisJobStatus = "queued" | "running" | "succeeded" | "failed";

export interface AnalysisJobContract {
  id: string;
  scanId: string;
  idempotencyKey: string;
  status: AnalysisJobStatus;
  safeErrorCode?:
    | "invalid_scan"
    | "analysis_unavailable"
    | "analysis_timeout"
    | "rate_limited";
  modelVersion?: string;
  promptVersion?: string;
  queuedAt: string;
  completedAt?: string;
  durationMs?: number;
}

export interface PriorityInsight {
  concern: ConcernKey;
  confidence: "low" | "medium" | "high";
  observedRegions: string[];
  explanation: string;
  uncertainty?: string;
  outlook?: string;
}

export interface SkinAssessmentContract {
  scanId: string;
  assessment: Assessment;
  /** Ordered and capped at three by the producer. */
  topPriorities: PriorityInsight[];
  nextAction: string;
  createdAt: string;
}

export interface RoutinePlanContract {
  id: string;
  version: number;
  sourceMode: "scan_and_intake" | "intake_only";
  sourceScanId?: string;
  intakeVersion: number;
  safetyEngineVersion: string;
  routine: Routine;
  revisionReason?: string;
  createdAt: string;
}

export interface ProductFormulationContract {
  id: string;
  brand: string;
  name: string;
  market: string;
  category: ProductCategory;
  inci?: string[];
  actives: ActiveKey[];
  source?: string;
  formulaVersion?: string;
  verification: "verified" | "unverified";
  verifiedAt?: string;
}

export interface EntitlementContract {
  plan: "free" | "plus";
  status: "inactive" | "trial" | "active" | "grace_period" | "expired";
  renewsAt?: string;
  expiresAt?: string;
}
