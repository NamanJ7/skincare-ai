import type { NativeFramePacket } from "./native-frame-evidence";

/** Receipt time is measured on the RN thread, never with camera-host seconds. */
export interface ReceivedNativeFrame {
  packet: NativeFramePacket;
  receivedAt: number;
}

export interface ArmedFrame extends ReceivedNativeFrame {
  perceptualHash: string;
}

export const ARMED_FRAME_MAX_AGE_MS = 900;

function usable(
  frame: ReceivedNativeFrame | null,
  now: number,
): frame is ReceivedNativeFrame {
  return Boolean(
    frame?.packet.pixels &&
    Number.isFinite(frame.receivedAt) &&
    frame.receivedAt <= now &&
    now - frame.receivedAt <= ARMED_FRAME_MAX_AGE_MS,
  );
}

/**
 * Bind a shutter press only to the last frame that passed the live quality
 * gate and armed capture. A merely recent pixel packet is not sufficient:
 * manual and automatic capture use the same fail-closed readiness contract.
 */
export function selectArmedFrame(
  armed: ReceivedNativeFrame | null,
  now: number,
): ArmedFrame | null {
  const selected = usable(armed, now) ? armed : null;
  const perceptualHash = selected?.packet.pixels?.perceptualHash;
  return selected && perceptualHash ? { ...selected, perceptualHash } : null;
}
