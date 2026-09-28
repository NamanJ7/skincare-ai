import { useState } from "react";
import { Platform } from "react-native";
import type { PermissionResponse } from "expo-camera";

import { openAppSettings } from "@/lib/external-links";

import {
  AppText,
  PrimaryButton,
  Screen,
  TextButton,
  spacing,
  useThemeColors,
} from "@/theme";

type RequestPermission = () => Promise<PermissionResponse>;

function withTimeout<T>(promise: Promise<T>, ms: number, message: string) {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (err) => {
        clearTimeout(id);
        reject(err);
      },
    );
  });
}

function isLocalWebOrigin() {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  return ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
}

function isSecureCameraOrigin() {
  if (Platform.OS !== "web" || typeof window === "undefined") return true;
  return window.isSecureContext || window.location.protocol === "https:" || isLocalWebOrigin();
}

async function requestBrowserCamera() {
  if (Platform.OS !== "web") return false;
  if (!isSecureCameraOrigin()) throw new Error("insecure_camera_origin");
  const mediaDevices = globalThis.navigator?.mediaDevices;
  if (!mediaDevices?.getUserMedia) throw new Error("camera_api_unavailable");

  const stream = await mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: "user" },
  });
  stream.getTracks().forEach((track) => track.stop());
  return true;
}

export function CameraPermissionGate({
  title = "Pore needs your camera",
  body,
  permission,
  requestPermission,
  onSecondary,
  secondaryLabel,
  onGranted,
}: {
  title?: string;
  body: string;
  permission: PermissionResponse;
  requestPermission: RequestPermission;
  onSecondary: () => void;
  secondaryLabel: string;
  onGranted?: () => void;
}) {
  const colors = useThemeColors();
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const askForCamera = async () => {
    if (requesting) return;
    setRequesting(true);
    setError(null);

    try {
      if (!isSecureCameraOrigin()) throw new Error("insecure_camera_origin");

      if (Platform.OS === "web") {
        await withTimeout(requestBrowserCamera(), 15000, "camera_permission_timeout");
        onGranted?.();
        void requestPermission().catch(() => {});
        return;
      }

      const result = await withTimeout(requestPermission(), 15000, "camera_permission_timeout");
      if (!result.granted) {
        throw new Error("camera_permission_denied");
      }
      onGranted?.();
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      setError(
        code === "insecure_camera_origin"
          ? "Camera access needs HTTPS on your phone. Use the HTTPS preview link, or use localhost on this laptop."
          : code === "camera_permission_timeout"
          ? "The browser did not finish the camera request. Check for a camera prompt, then tap Allow camera again."
          : Platform.OS === "web"
          ? "Camera access was not granted. Check the browser camera icon or site settings, then try again."
          : "Camera access was not granted. Check Settings, then try again.",
      );
    } finally {
      setRequesting(false);
    }
  };

  return (
    <Screen contentStyle={{ justifyContent: "center", gap: spacing.md }}>
      <AppText variant="titleSans">{title}</AppText>
      <AppText variant="body" color={colors.textSecondary}>
        {body}
      </AppText>
      {permission.canAskAgain || Platform.OS === "web" ? (
        <PrimaryButton label="Allow camera" onPress={askForCamera} loading={requesting} />
      ) : (
        <PrimaryButton label="Open Settings" onPress={() => void openAppSettings()} />
      )}
      {error ? (
        <AppText variant="caption" color={colors.error}>
          {error}
        </AppText>
      ) : null}
      <TextButton label={secondaryLabel} onPress={onSecondary} />
    </Screen>
  );
}
