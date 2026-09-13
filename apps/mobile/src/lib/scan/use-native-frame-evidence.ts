import { useCallback, useEffect, useRef, useState } from "react";
import { useSharedValue } from "react-native-reanimated";
import {
  CommonResolutions,
  useFrameOutput,
  type CameraFrameOutput,
} from "react-native-vision-camera";
import { useFaceDetector } from "react-native-vision-camera-face-detector";
import { scheduleOnRN } from "react-native-worklets";

import {
  isGenuinelyNewFrame,
  serializeFace,
  type NativeFramePacket,
} from "./native-frame-evidence";
import {
  sampleFacialSkinFromLumaPlane,
  scaleFacialSamplingGeometry,
} from "./pixel-evidence";

const LIVE_EVALUATION_INTERVAL_SECONDS = 0.18;

export interface NativeFrameEvidenceState {
  output: CameraFrameOutput;
  packet: NativeFramePacket | null;
  receivedAt: number | null;
  /** Bumped whenever packet continuity is known to have broken. */
  discontinuityVersion: number;
  error: string | null;
}

/**
 * Streams actual VGA camera frames through one synchronous worker callback.
 * Face geometry and skin pixels therefore belong to the same frame. Packets
 * with repeated/non-monotonic camera timestamps are dropped on the RN thread.
 */
export function useNativeFrameEvidence(
  active: boolean,
): NativeFrameEvidenceState {
  const [packet, setPacket] = useState<NativeFramePacket | null>(null);
  const [receivedAt, setReceivedAt] = useState<number | null>(null);
  const [discontinuityVersion, setDiscontinuityVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const latestRef = useRef<NativeFramePacket | null>(null);
  const lastProcessedTimestamp = useSharedValue(-1);
  const detector = useFaceDetector({
    cameraFacing: "front",
    performanceMode: "fast",
    runLandmarks: true,
    runContours: true,
    runClassifications: false,
    minFaceSize: 0.12,
    trackingEnabled: false,
    autoMode: false,
  });

  const receivePacket = useCallback((next: NativeFramePacket) => {
    if (!isGenuinelyNewFrame(latestRef.current, next)) {
      latestRef.current = null;
      setPacket(null);
      setReceivedAt(null);
      setDiscontinuityVersion((value) => value + 1);
      return;
    }
    latestRef.current = next;
    setPacket(next);
    setReceivedAt(Date.now());
    setError(null);
  }, []);

  const receiveError = useCallback((message: string) => {
    setError(message || "Camera quality validation is unavailable.");
    setPacket(null);
    setReceivedAt(null);
    setDiscontinuityVersion((value) => value + 1);
  }, []);

  const receiveDiscontinuity = useCallback(() => {
    latestRef.current = null;
    setPacket(null);
    setReceivedAt(null);
    setDiscontinuityVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    if (active) return;
    latestRef.current = null;
    lastProcessedTimestamp.value = -1;
    setPacket(null);
    setReceivedAt(null);
    setError(null);
    setDiscontinuityVersion((value) => value + 1);
  }, [active, lastProcessedTimestamp]);

  const output = useFrameOutput({
    targetResolution: CommonResolutions.VGA_4_3,
    pixelFormat: "yuv",
    enablePhysicalBufferRotation: true,
    dropFramesWhileBusy: true,
    onFrame(frame) {
      "worklet";
      try {
        const timestamp = frame.timestamp;
        if (!active || timestamp <= 0) {
          frame.dispose();
          return;
        }
        if (lastProcessedTimestamp.value >= 0) {
          if (timestamp <= lastProcessedTimestamp.value) {
            scheduleOnRN(receiveDiscontinuity);
            frame.dispose();
            return;
          }
          if (
            timestamp - lastProcessedTimestamp.value <
            LIVE_EVALUATION_INTERVAL_SECONDS
          ) {
            frame.dispose();
            return;
          }
        }
        lastProcessedTimestamp.value = timestamp;

        const detected = detector.detectFaces(frame);
        const faces = [];
        // Raw analysis buffers can be mirrored relative to the camera output
        // the shared pose bands are defined against; correcting here keeps live
        // guidance and the final still on one convention (see native-pose.ts).
        const frameIsMirrored = frame.isMirrored === true;
        for (let i = 0; i < detected.length; i++) {
          const serialized = serializeFace(detected[i], frameIsMirrored);
          if (serialized != null) faces.push(serialized);
        }

        let pixels = null;
        if (faces.length === 1 && frame.isPlanar) {
          const planes = frame.getPlanes();
          const yPlane = planes[0];
          if (yPlane != null && yPlane.isValid) {
            const nativeFace = faces[0];
            const xScale = yPlane.width / nativeFace.frameWidth;
            const yScale = yPlane.height / nativeFace.frameHeight;
            pixels = sampleFacialSkinFromLumaPlane(
              new Uint8Array(yPlane.getPixelBuffer()),
              yPlane.width,
              yPlane.height,
              yPlane.bytesPerRow,
              {
                x: nativeFace.bounds.x * xScale,
                y: nativeFace.bounds.y * yScale,
                width: nativeFace.bounds.width * xScale,
                height: nativeFace.bounds.height * yScale,
              },
              scaleFacialSamplingGeometry(
                nativeFace.samplingGeometry,
                xScale,
                yScale,
              ),
            );
          }
        }

        const timestampMicros = Math.round(timestamp * 1_000_000);
        const next: NativeFramePacket = {
          frameId:
            String(timestampMicros) +
            ":" +
            String(frame.width) +
            "x" +
            String(frame.height),
          timestamp,
          width: frame.width,
          height: frame.height,
          isMirrored: frame.isMirrored,
          faces,
          pixels,
        };
        scheduleOnRN(receivePacket, next);
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : "Native frame validation failed.";
        scheduleOnRN(receiveError, message);
      } finally {
        if (frame.isValid) frame.dispose();
      }
    },
    onFrameDropped() {
      // Dropping a busy frame is expected. Readiness only advances on packets
      // that did arrive, so dropped frames can never be counted as passing.
    },
  });

  return { output, packet, receivedAt, discontinuityVersion, error };
}
