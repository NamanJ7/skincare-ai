import { CryptoDigestAlgorithm, digest, randomUUID } from "expo-crypto";
import { File } from "expo-file-system";

import { base64ToBytes } from "./base64";
import { bytesToHex } from "./digest-utils";

export { bytesToHex } from "./digest-utils";

/** SHA-256 of the exact bytes that will be validated/submitted. */
export async function sha256Bytes(bytes: Uint8Array): Promise<string> {
  const exact = new Uint8Array(bytes.length);
  exact.set(bytes);
  return bytesToHex(await digest(CryptoDigestAlgorithm.SHA256, exact));
}

export async function sha256Base64(base64: string): Promise<string> {
  return sha256Bytes(base64ToBytes(base64));
}

export async function readFileIdentity(uri: string): Promise<{
  bytes: Uint8Array;
  byteLength: number;
  contentDigest: string;
}> {
  const bytes = await new File(uri).bytes();
  if (bytes.length === 0) throw new Error("Captured image is empty.");
  return { bytes, byteLength: bytes.length, contentDigest: await sha256Bytes(bytes) };
}

export function createScanId(prefix: "session" | "capture"): string {
  return `${prefix}-${randomUUID()}`;
}
