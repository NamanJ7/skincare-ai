/** Browser-only assets bound to a shared accepted-capture quality record. */
import type { AcceptedCapture, QualityResult, StepId } from "@pore/shared/scan";

export interface CapturedShot {
  stepId: StepId;
  source: "camera" | "upload";
  /** Exact original bytes whose SHA-256 is bound in `acceptance`. */
  originalBlob: Blob;
  originalMediaType: string;
  /** Derivative created only after the original passes the final gate. */
  analysisBlob: Blob;
  base64: string;
  mediaType: "image/jpeg";
  analysisWidth: number;
  analysisHeight: number;
  /** The multi-frame result that armed a camera capture. Uploads retain their
   * independent preflight result here. */
  liveQuality: QualityResult;
  /** Full-resolution encoded original passed independently before derivation. */
  originalQuality: QualityResult;
  /** Shared final binding used by session validation and analysis. */
  acceptance: AcceptedCapture;
  /** Hash of the exact live frame that armed a camera shutter. */
  previewPerceptualHash: string;
  /** Object URL for display only; never used as analysis input. */
  previewUrl: string;
}
