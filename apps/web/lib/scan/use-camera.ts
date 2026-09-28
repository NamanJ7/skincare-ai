"use client";

/**
 * getUserMedia lifecycle. Owns the stream and guarantees track cleanup on
 * unmount, tab hide, and page hide (iOS kills backgrounded streams anyway —
 * stopping proactively and restarting on return avoids a frozen preview).
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type CameraStatus =
  | "idle"
  | "starting"
  | "active"
  | "denied"
  | "unavailable"
  | "unsupported";

export interface CameraController {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  status: CameraStatus;
  start: () => void;
  stop: () => void;
  switchCamera: () => void;
  hasMultipleCameras: boolean;
}

const CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  // Hints only — front cameras ignore `ideal` freely; consumers must size
  // from the actual videoWidth/videoHeight after loadedmetadata.
  // Ask for enough native pixels to preserve cheek texture after the centered
  // 3:4 crop. The final shared resolution gate still reads the actual track
  // dimensions because browsers are free to return less than these ideals.
  video: { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1440 } },
};

export function useCamera(): CameraController {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const deviceIdsRef = useRef<string[]>([]);
  const currentDeviceRef = useRef<string | null>(null);
  const wantedRef = useRef(false); // user intent, survives visibility churn
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const open = useCallback(async (deviceId?: string) => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setStatus("unsupported");
      return;
    }
    setStatus("starting");
    stopTracks();
    try {
      const constraints: MediaStreamConstraints = deviceId
        ? { audio: false, video: { deviceId: { exact: deviceId } } }
        : CONSTRAINTS;
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      currentDeviceRef.current =
        deviceId ?? stream.getVideoTracks()[0]?.getSettings().deviceId ?? null;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Muted + playsInline lets play() succeed without a fresh gesture.
        await videoRef.current.play().catch(() => undefined);
      }
      setStatus("active");

      // Labels/devices only enumerate reliably after a grant.
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const cams = devices.filter((d) => d.kind === "videoinput" && d.deviceId);
        deviceIdsRef.current = cams.map((d) => d.deviceId);
        setHasMultipleCameras(cams.length > 1);
      } catch {
        /* enumeration is best-effort */
      }
    } catch (err) {
      stopTracks();
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") setStatus("denied");
      else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setStatus("unavailable");
      } else setStatus("unavailable");
    }
  }, [stopTracks]);

  const start = useCallback(() => {
    wantedRef.current = true;
    void open();
  }, [open]);

  const stop = useCallback(() => {
    wantedRef.current = false;
    stopTracks();
    setStatus("idle");
  }, [stopTracks]);

  const switchCamera = useCallback(() => {
    const ids = deviceIdsRef.current;
    if (ids.length < 2) return;
    const idx = ids.indexOf(currentDeviceRef.current ?? "");
    void open(ids[(idx + 1) % ids.length]);
  }, [open]);

  // Suspend on hide, resume on return (only if the user still wants camera).
  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        stopTracks();
      } else if (wantedRef.current && !streamRef.current) {
        void open(currentDeviceRef.current ?? undefined);
      }
    };
    const onPageHide = () => stopTracks();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      stopTracks(); // unmount / route change — the non-negotiable cleanup
    };
  }, [open, stopTracks]);

  return { videoRef, status, start, stop, switchCamera, hasMultipleCameras };
}
