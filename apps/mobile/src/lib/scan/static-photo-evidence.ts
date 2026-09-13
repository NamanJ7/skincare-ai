import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

import { discardTempPhotos } from "@/lib/photos";
import { decode } from "jpeg-js";
import type { ImageFaceDetector } from "react-native-vision-camera-face-detector";

import { base64ToBytes } from "./base64";
import { serializeFace, type NativeFramePacket } from "./native-frame-evidence";
import { evaluateNativePacket, type NativeEvidenceIdentity } from "./native-quality-adapter";
import {
  sampleFacialSkinFromRgba,
  scaleFacialSamplingGeometry,
  type FacialSamplingGeometry,
  type PixelRect,
} from "./pixel-evidence";

/**
 * Upper bound on the face crop decoded for measurement.
 *
 * Blur is the one property a downscale destroys rather than preserves, so
 * facial pixels are measured near native resolution. This used to run against a
 * 384px render of the *whole* photo, which left the face around 150px wide —
 * far too small to see the focus and motion blur that ruins a skin read at the
 * size the model actually receives. Cropping to the face first is what makes
 * native resolution affordable: decoding a full 2576px capture would be ~35MB
 * of RGBA for an image that is mostly hair and background.
 */
const MAX_FACE_CROP_WIDTH = 1024;
/** Context kept around the detected box so edge stencils have neighbours. */
const FACE_CROP_MARGIN = 0.12;

function clampRect(rect: PixelRect, width: number, height: number): PixelRect {
  const x = Math.max(0, Math.min(Math.round(rect.x), width - 1));
  const y = Math.max(0, Math.min(Math.round(rect.y), height - 1));
  return {
    x,
    y,
    width: Math.max(1, Math.min(Math.round(rect.width), width - x)),
    height: Math.max(1, Math.min(Math.round(rect.height), height - y)),
  };
}

/**
 * Measure facial skin on a near-native crop of the saved file.
 *
 * The perceptual hash this produces stays comparable to the live one because
 * `makeHash` samples an 8x8 grid across the face box either way — the binding
 * is scale-invariant by construction, which is exactly why sharpness cannot be.
 */
async function measureFaceCrop(
  uri: string,
  face: NonNullable<ReturnType<typeof serializeFace>>,
  originalWidth: number,
  originalHeight: number,
) {
  // Detector coordinates live in its own frame space; move them onto the file.
  const toFileX = originalWidth / face.frameWidth;
  const toFileY = originalHeight / face.frameHeight;
  const marginX = face.bounds.width * toFileX * FACE_CROP_MARGIN;
  const marginY = face.bounds.height * toFileY * FACE_CROP_MARGIN;
  const crop = clampRect(
    {
      x: face.bounds.x * toFileX - marginX,
      y: face.bounds.y * toFileY - marginY,
      width: face.bounds.width * toFileX + marginX * 2,
      height: face.bounds.height * toFileY + marginY * 2,
    },
    originalWidth,
    originalHeight,
  );

  const context = ImageManipulator.manipulate(uri);
  context.crop({
    originX: crop.x,
    originY: crop.y,
    width: crop.width,
    height: crop.height,
  });
  // Only ever downscale; a small capture keeps every pixel it has.
  if (crop.width > MAX_FACE_CROP_WIDTH) {
    context.resize({ width: MAX_FACE_CROP_WIDTH, height: null });
  }
  // compress 1 because this encode sits between the sensor and the sharpness
  // measurement, and JPEG discards high-frequency detail first.
  const rendered = await (await context.renderAsync()).saveAsync({
    format: SaveFormat.JPEG,
    compress: 1,
    base64: true,
  });
  // Consumed as base64 immediately below; the file itself is never reused.
  discardTempPhotos([rendered.uri]);
  if (!rendered.base64) return null;

  const decoded = decode(base64ToBytes(rendered.base64), {
    useTArray: true,
    formatAsRGBA: true,
  });
  // detector space -> file space -> crop space -> decoded space.
  const ratioX = decoded.width / crop.width;
  const ratioY = decoded.height / crop.height;
  const scaleX = toFileX * ratioX;
  const scaleY = toFileY * ratioY;
  const offsetX = crop.x * ratioX;
  const offsetY = crop.y * ratioY;

  return sampleFacialSkinFromRgba(
    new Uint8Array(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength),
    decoded.width,
    decoded.height,
    {
      x: face.bounds.x * scaleX - offsetX,
      y: face.bounds.y * scaleY - offsetY,
      width: face.bounds.width * scaleX,
      height: face.bounds.height * scaleY,
    },
    translateGeometry(
      scaleFacialSamplingGeometry(face.samplingGeometry, scaleX, scaleY),
      -offsetX,
      -offsetY,
    ),
  );
}

/** Detect and measure the actual encoded file represented by `identity`. */
export async function evaluateStaticPhoto(
  uri: string,
  detector: ImageFaceDetector,
  identity: NativeEvidenceIdentity,
  originalWidth: number,
  originalHeight: number,
) {
  // The saved file already IS the camera output presentation, so its yaw needs
  // no mirror correction — unlike the raw live analysis buffer.
  const faces = (await detector.detectFaces(uri))
    .map((face) => serializeFace(face, false))
    .filter((face): face is NonNullable<typeof face> => face != null);

  const face = faces[0];
  const pixels =
    faces.length === 1 && face
      ? await measureFaceCrop(uri, face, originalWidth, originalHeight)
      : null;

  const packet: NativeFramePacket = {
    frameId: identity.frameId,
    timestamp: identity.capturedAt / 1_000,
    width: originalWidth,
    height: originalHeight,
    faces,
    pixels,
  };
  return evaluateNativePacket(packet, null, identity);
}

function translateGeometry(
  geometry: FacialSamplingGeometry | undefined,
  dx: number,
  dy: number,
): FacialSamplingGeometry | undefined {
  if (!geometry) return undefined;
  const shift = <T extends { center: { x: number; y: number } }>(ellipse: T): T => ({
    ...ellipse,
    center: { x: ellipse.center.x + dx, y: ellipse.center.y + dy },
  });
  return {
    skinRegions: geometry.skinRegions.map(shift),
    excludedRegions: geometry.excludedRegions.map(shift),
    ...(geometry.faceContour
      ? {
          faceContour: geometry.faceContour.map((point) => ({
            x: point.x + dx,
            y: point.y + dy,
          })),
        }
      : {}),
  };
}
