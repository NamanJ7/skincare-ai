import {
  CryptoDigestAlgorithm,
  digestStringAsync,
  randomUUID,
} from "expo-crypto";

import type { GuardianCredential } from "@pore/shared";

export function isGuardianPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

async function digestPin(pin: string, salt: string): Promise<string> {
  return digestStringAsync(CryptoDigestAlgorithm.SHA256, `${salt}:${pin}`);
}

export async function createGuardianCredential(
  pin: string,
): Promise<GuardianCredential> {
  if (!isGuardianPin(pin)) {
    throw new Error("Guardian PIN must contain exactly four digits.");
  }
  const salt = randomUUID();
  return {
    algorithm: "sha256",
    salt,
    digest: await digestPin(pin, salt),
  };
}

export async function verifyGuardianPin(
  pin: string,
  credential: GuardianCredential,
): Promise<boolean> {
  if (!isGuardianPin(pin) || credential.algorithm !== "sha256") return false;
  return (await digestPin(pin, credential.salt)) === credential.digest;
}
