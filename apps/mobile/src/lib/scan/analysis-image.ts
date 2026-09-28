/**
 * Maximum width of the JPEG sent for analysis; smaller sources stay native.
 *
 * 2576px is the vision model's own high-resolution ceiling, and skin reads live
 * exactly at the spatial frequencies a smaller derivative destroys: pore
 * visibility, closed comedones, fine lines, and small papules survive here and
 * do not survive at 1536. Raising this costs image tokens and nothing else.
 */
export const ANALYSIS_MAX_WIDTH = 2576;

/** Null means keep the decoded source dimensions — never upscale a weak image. */
export function analysisResizeWidth(sourceWidth: number): number | null {
  if (!Number.isFinite(sourceWidth) || sourceWidth <= 0)
    throw new Error("Captured image dimensions are invalid.");
  return sourceWidth > ANALYSIS_MAX_WIDTH ? ANALYSIS_MAX_WIDTH : null;
}
