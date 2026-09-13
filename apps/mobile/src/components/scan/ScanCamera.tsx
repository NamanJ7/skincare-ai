/** Native guided camera backed by one synchronized face + pixel frame packet. */
import * as Haptics from "expo-haptics";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  StyleSheet,
  View,
  type LayoutChangeEvent,
} from "react-native";
import {
  Camera,
  CommonResolutions,
  usePhotoOutput,
  type CameraRef,
  type MeteringMode,
} from "react-native-vision-camera";

import { createScanId } from "@/lib/scan/content-digest";
import { orientPreviewPerceptualHash } from "@/lib/scan/pixel-evidence";
import { useNativeFrameEvidence } from "@/lib/scan/use-native-frame-evidence";
import { useNativeGuidance } from "@/lib/scan/use-native-guidance";
import type { ScanCameraHandle, ScanCameraProps } from "./scan-camera-types";

/**
 * Pixel dimensions of `PHOTO_RESOLUTION`, declared to the live quality gate.
 *
 * Live guidance runs on a VGA analysis stream (useNativeFrameEvidence) while
 * the shutter produces this much larger still, so the resolution gate has to
 * judge the still it is *configured* to take. Keep these two lines in sync: the
 * final gate independently re-measures the real decoded JPEG, so an optimistic
 * declaration here delays a rejection rather than laundering one.
 */
const PHOTO_RESOLUTION = CommonResolutions.UHD_4_3;
const PHOTO_WIDTH = 3840;
const PHOTO_HEIGHT = 2880;

export const ScanCamera = forwardRef<ScanCameraHandle, ScanCameraProps>(
  function ScanCamera(
    { step, resetKey, active, onReady, onGuidance, onError, onCapture },
    ref,
  ) {
    const window = Dimensions.get("window");
    const [size, setSize] = useState({ w: window.width, h: window.height });
    const [meteringReady, setMeteringReady] = useState(false);
    const cameraRef = useRef<CameraRef>(null);
    const busyRef = useRef(false);
    const readyRef = useRef(false);
    const meteringReadyRef = useRef(false);
    const meteringInFlightRef = useRef(false);
    const meteringLockedRef = useRef(false);
    const guidanceReadyRef = useRef(false);
    const activeRef = useRef(active);
    activeRef.current = active;

    const photoOutput = usePhotoOutput({
      targetResolution: PHOTO_RESOLUTION,
      containerFormat: "jpeg",
      quality: 0.9,
      qualityPrioritization: "quality",
    });
    const evidence = useNativeFrameEvidence(active);

    function capture(): boolean {
      if (
        !activeRef.current ||
        busyRef.current ||
        !readyRef.current ||
        !meteringReadyRef.current
      )
        return false;
      const armed = getArmedFrame();
      if (!armed) return false;
      const capturedAt = Date.now();
      const captureId = createScanId("capture");
      busyRef.current = true;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(
        () => {},
      );
      void photoOutput
        .capturePhotoToFile(
          {
            flashMode: "off",
            enableShutterSound: true,
            enableDistortionCorrection: false,
          },
          {},
        )
        .then((photo) => {
          if (!activeRef.current) return;
          const previewHashMirrorApplied = armed.packet.isMirrored === true;
          const previewPerceptualHash = orientPreviewPerceptualHash(
            armed.perceptualHash,
            previewHashMirrorApplied,
          );
          onCapture(
            photo.filePath.startsWith("file://")
              ? photo.filePath
              : `file://${photo.filePath}`,
            {
              captureId,
              capturedAt,
              previewPerceptualHash,
              previewFrameId: armed.packet.frameId,
              previewHashMirrorApplied,
              previewYawDeg: armed.packet.faces[0]?.yawDeg,
            },
          );
        })
        .catch((cause) => {
          if (__DEV__) console.warn("[ScanCamera] capture failed", cause);
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
    }

    const { guidance, getArmedFrame, invalidateReadiness } =
      useNativeGuidance({
        step,
        resetKey,
        active,
        packet: evidence.packet,
        packetReceivedAt: evidence.receivedAt,
        discontinuityVersion: evidence.discontinuityVersion,
        evidenceError: evidence.error,
        stillWidth: PHOTO_WIDTH,
        stillHeight: PHOTO_HEIGHT,
        onAutoCapture: capture,
      });
    guidanceReadyRef.current = guidance.manualCaptureReady;

    useEffect(() => {
      void photoOutput
        .prepareSettings([
          {
            flashMode: "off",
            enableDistortionCorrection: false,
          },
        ])
        .catch(() => {});
    }, [photoOutput]);

    useEffect(() => {
      onGuidance?.({
        ...guidance,
        manualCaptureReady:
          guidance.manualCaptureReady && meteringReady,
      });
    }, [guidance, meteringReady, onGuidance]);

    const resetMetering = () => {
      meteringInFlightRef.current = false;
      meteringReadyRef.current = false;
      setMeteringReady(false);
      if (meteringLockedRef.current) {
        meteringLockedRef.current = false;
        void cameraRef.current?.resetFocus().catch(() => {});
      }
    };

    // Once packet readiness is proven, meter AE/AF/AWB at that same face and
    // lock supported modes through countdown/capture. Unsupported modes remain
    // continuous-auto and do not weaken the strict pixel gate.
    useEffect(() => {
      if (!guidance.manualCaptureReady) {
        resetMetering();
        return;
      }
      if (
        meteringReadyRef.current ||
        meteringInFlightRef.current ||
        !activeRef.current
      )
        return;
      const ref = cameraRef.current;
      const controller = ref?.controller;
      const face = evidence.packet?.faces[0];
      if (!ref || !controller || !face) return;
      const device = controller.device;
      const modes: MeteringMode[] = [];
      if (device.supportsFocusMetering) modes.push("AF");
      if (device.supportsExposureMetering) modes.push("AE");
      if (device.supportsWhiteBalanceMetering) modes.push("AWB");
      if (modes.length === 0) {
        meteringReadyRef.current = true;
        setMeteringReady(true);
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
          () => {},
        );
        return;
      }

      meteringInFlightRef.current = true;
      const normalizedX = evidence.packet?.isMirrored
        ? 1 - face.centerX
        : face.centerX;
      void ref
        .focusTo(
          { x: normalizedX * size.w, y: face.centerY * size.h },
          {
            modes,
            responsiveness: "steady",
            adaptiveness: "locked",
            autoResetAfter: null,
          },
        )
        .then(() => {
          if (!activeRef.current || !guidanceReadyRef.current) return;
          meteringLockedRef.current = true;
          meteringReadyRef.current = true;
          setMeteringReady(true);
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            () => {},
          );
        })
        .catch(() => {
          invalidateReadiness();
        })
        .finally(() => {
          meteringInFlightRef.current = false;
        });
  }, [
      evidence.packet,
      guidance.manualCaptureReady,
      invalidateReadiness,
      size.h,
      size.w,
    ]);

    useEffect(() => {
      if (active) return;
      readyRef.current = false;
      busyRef.current = false;
      resetMetering();
      invalidateReadiness();
    }, [active, invalidateReadiness]);

    useEffect(() => {
      if (!active || !evidence.error) return;
      const timer = setTimeout(() => {
        readyRef.current = false;
        onError?.({
          kind: "session",
          message:
            "Camera quality checks stopped. Restart the camera to continue safely.",
        });
      }, 1_500);
      return () => clearTimeout(timer);
    }, [active, evidence.error, onError]);

    useImperativeHandle(ref, () => ({ capture }));

    const onLayout = (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    };

    return (
      <View style={StyleSheet.absoluteFill} onLayout={onLayout}>
        <Camera
          ref={cameraRef}
          style={StyleSheet.absoluteFill}
          device="front"
          isActive={active}
          outputs={[photoOutput, evidence.output]}
          mirrorMode="auto"
          orientationSource="device"
          enableDistortionCorrection={false}
          enableLowLightBoost={false}
          torchMode="off"
          onError={(error) => {
            readyRef.current = false;
            busyRef.current = false;
            invalidateReadiness();
            if (__DEV__) console.warn("[ScanCamera] camera error", error);
            if (!activeRef.current) return;
            onError?.({
              kind: "session",
              message:
                "The camera stopped unexpectedly. Restart it to continue.",
            });
          }}
          onInterruptionStarted={() => {
            readyRef.current = false;
            resetMetering();
            invalidateReadiness();
          }}
          onInterruptionEnded={() => {
            resetMetering();
            invalidateReadiness();
          }}
          onSubjectAreaChanged={() => {
            resetMetering();
            invalidateReadiness();
          }}
          onPreviewStarted={() => {
            if (!activeRef.current) return;
            readyRef.current = true;
            onReady?.();
          }}
          onPreviewStopped={() => {
            readyRef.current = false;
            busyRef.current = false;
            resetMetering();
            invalidateReadiness();
          }}
        />
      </View>
    );
  },
);
