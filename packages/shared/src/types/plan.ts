/**
 * The /api/plan contract, owned in one place.
 *
 * This used to be declared twice — once in apps/web/lib/pipeline.ts and once in
 * apps/mobile/src/lib/api.ts — and the two had already drifted: the server
 * accepted a per-image `quality` measurement and the client that produces that
 * measurement had no field for it in its own request type. The client happened
 * to send it anyway, so nothing broke, but neither end described the same API.
 *
 * A contract with two authors has no author. Both ends import these now.
 */
import type { SafetyAdjustment } from "../safety/engine";
import type { Assessment, PhotoQuality } from "./assessment";
import type { IntakeResponse } from "./intake";
import type { Routine } from "./routine";

export type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export interface PlanImage {
  /** base64-encoded image bytes (no data: prefix). */
  data: string;
  mediaType?: ImageMediaType;
  /**
   * What the on-device capture gate measured for this shot. Optional so older
   * clients keep working, but when present it is put in front of the image so
   * the model can weight what it is looking at.
   */
  quality?: PhotoQuality;
}

export interface PlanInput {
  images: PlanImage[];
  intake: IntakeResponse;
}

export interface PlanResult {
  assessment: Assessment;
  routine: Routine;
  adjustments: SafetyAdjustment[];
  /** Whether a model produced this, or the deterministic offline stand-in did. */
  mode: "ai" | "mock";
}

/**
 * Why a plan request failed, in terms the UI can act on.
 *
 * The distinction that matters to someone staring at a spinner is whether
 * trying again could work. "offline" and "busy" say yes; "rejected" says the
 * request itself was wrong and retrying it will fail the same way.
 */
export type PlanErrorKind = "offline" | "busy" | "rejected" | "unknown";

export interface PlanError {
  kind: PlanErrorKind;
  /** Copy written for the person waiting, not for a log. */
  message: string;
  retryable: boolean;
}
