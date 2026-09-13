/**
 * Capture identity and content provenance.
 *
 * IDs prevent asynchronous React work from being attached to a different
 * session/capture. SHA-256 binds the accepted quality record to the exact
 * original bytes retained in the draft. Perceptual hashes remain separate:
 * they detect near-duplicate poses, while a cryptographic digest detects an
 * exact stale/reused file.
 */

export function newScanSessionId(): string {
  return id("scan");
}

export function newCaptureId(): string {
  return id("capture");
}

export function newFrameId(): string {
  return id("frame");
}

export async function sha256Blob(blob: Blob): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Secure image digest is unavailable");
  const digest = await subtle.digest("SHA-256", await blob.arrayBuffer());
  return bytesToHex(new Uint8Array(digest));
}

export function isSha256(value: string): boolean {
  return /^[a-f0-9]{64}$/u.test(value);
}

function id(prefix: string): string {
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.randomUUID) {
    // Capture provenance is security-sensitive; a timestamp/Math.random ID is
    // not an acceptable silent fallback.
    throw new Error("Secure capture identity is unavailable");
  }
  return `${prefix}_${cryptoApi.randomUUID()}`;
}

function bytesToHex(bytes: Uint8Array): string {
  let result = "";
  for (const byte of bytes) result += byte.toString(16).padStart(2, "0");
  return result;
}
