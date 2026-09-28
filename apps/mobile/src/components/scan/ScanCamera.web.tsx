/**
 * Web scan camera — expo-camera preview + the MediaPipe live-guidance loop.
 * This is the original capture-screen camera surface, extracted so the capture
 * screen can stay platform-neutral. Guidance reads the <video> inside the
 * wrapper View (containerRef); capture uses expo-camera's takePictureAsync.
 */
import { CameraView } from "expo-camera";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";

import { useLiveGuidance } from "@/lib/scan/use-live-guidance";
import { createScanId } from "@/lib/scan/content-digest";
import type { ScanCameraHandle, ScanCameraProps } from "./scan-camera-types";

export const ScanCamera = forwardRef<ScanCameraHandle, ScanCameraProps>(
  function ScanCamera(
    { step, resetKey, active, onReady, onGuidance, onError, onCapture },
    ref,
  ) {
    const cameraRef = useRef<CameraView>(null);
    const containerRef = useRef<View>(null);
    const [cameraReady, setCameraReady] = useState(false);
    const busyRef = useRef(false);
    const activeRef = useRef(active);
    activeRef.current = active;

    const capture = () => {
      if (!activeRef.current || busyRef.current || !cameraReady || !cameraRef.current) return false;
      const capturedAt = Date.now();
      const captureId = createScanId("capture");
      busyRef.current = true;
      void cameraRef.current
        .takePictureAsync({ quality: 0.9 })
        .then((photo) => {
          if (activeRef.current && photo?.uri) {
            onCapture(photo.uri, { captureId, capturedAt });
          }
        })
        .catch((error) => {
          if (__DEV__) console.warn("[ScanCamera] capture failed", error);
          if (!activeRef.current) return;
          onError?.({
            kind: "capture",
            message: "We couldn't take that photo. Hold still and try again.",
          });
        })
        .finally(() => {
          busyRef.current = false;
        });
      return true;
    };

    const guidance = useLiveGuidance({
      containerRef,
      cameraReady,
      step,
      resetKey,
      active,
      onAutoCapture: () => void capture(),
    });

    useEffect(() => {
      onGuidance?.(guidance);
    }, [guidance, onGuidance]);

    useEffect(() => {
      if (active) return;
      setCameraReady(false);
      busyRef.current = false;
    }, [active]);

    useImperativeHandle(ref, () => ({ capture }));

    return (
      <View style={StyleSheet.absoluteFill} ref={containerRef}>
        {active ? (
          <CameraView
            ref={cameraRef}
            facing="front"
            style={StyleSheet.absoluteFill}
            onCameraReady={() => {
              setCameraReady(true);
              onReady?.();
            }}
            onMountError={(event) => {
              setCameraReady(false);
              onError?.({
                kind: "session",
                message: "The camera couldn't start. Restart it to try again.",
              });
              if (__DEV__) console.warn("[ScanCamera] camera mount failed", event.message);
            }}
          />
        ) : null}
      </View>
    );
  },
);
