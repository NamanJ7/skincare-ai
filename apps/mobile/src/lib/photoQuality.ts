/**
 * Turns a captured frame into pixels the shared vision engine can measure.
 *
 * The crop happens BEFORE the downscale on purpose. Sharpness lives in
 * high-frequency detail, so resizing a full 12MP frame straight down to 256px
 * destroys the exact signal we are trying to measure and every photo would
 * score as blurry. Crop a centre region at near-native resolution first, then
 * resize that.
 */
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { File } from "expo-file-system";
import { decode } from "jpeg-js";
import { scoreFrame, type FrameScore, type SkinTone } from "@pore/shared";

/** Side length of the centre region sampled from the original frame, in source pixels. */
const CROP_PX = 600;
/** Side length the crop is reduced to before decoding. Big enough to keep detail, small enough to be instant. */
const ANALYSIS_PX = 256;

/**
 * Measure one captured photo. Throws if the frame cannot be decoded — the
 * caller treats that as a failed capture rather than a crash, because a
 * corrupt frame and an unusable frame need the same response from the user.
 */
export async function measureCapture(
  uri: string,
  width: number,
  height: number,
  tone: SkinTone,
): Promise<FrameScore> {
  // Centre square, clamped to whatever the frame can actually give us.
  const side = Math.min(CROP_PX, width, height);
  const originX = Math.max(0, Math.round((width - side) / 2));
  const originY = Math.max(0, Math.round((height - side) / 2));

  const rendered = await ImageManipulator.manipulate(uri)
    .crop({ originX, originY, width: side, height: side })
    .resize({ width: ANALYSIS_PX, height: ANALYSIS_PX })
    .renderAsync();
  const analysis = await rendered.saveAsync({ compress: 1, format: SaveFormat.JPEG });

  const file = new File(analysis.uri);
  const bytes = await file.bytes();
  const raw = decode(bytes, { useTArray: true });

  try {
    return scoreFrame(raw.data as unknown as Uint8Array, raw.width, raw.height, tone);
  } finally {
    // The analysis crop is a throwaway; only the delivered photo is kept.
    try {
      file.delete();
    } catch {
      // A leftover file in the cache is not worth failing a capture over.
    }
  }
}
