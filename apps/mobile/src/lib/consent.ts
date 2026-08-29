import * as SecureStore from "expo-secure-store";
import type { ConsentStatus } from "@pore/shared";

// Reuses the same API origin as fetchPlan (see api.ts) -- unset in dev means
// there's no server to talk to, so the consent screen can't proceed either.
const BASE = process.env.EXPO_PUBLIC_API_URL;

const STORE_KEY = "pore.parentalConsent";

export interface StoredConsent {
  id: string;
  parentEmail: string;
}

/** Persisted across app restarts so a parent approving while the app is
 *  closed (or killed) isn't lost -- the in-memory onboarding state resets on
 *  restart, but the pending request shouldn't have to. */
export async function saveConsent(consent: StoredConsent): Promise<void> {
  await SecureStore.setItemAsync(STORE_KEY, JSON.stringify(consent));
}

export async function loadConsent(): Promise<StoredConsent | null> {
  const raw = await SecureStore.getItemAsync(STORE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredConsent;
  } catch {
    return null;
  }
}

export async function clearConsent(): Promise<void> {
  await SecureStore.deleteItemAsync(STORE_KEY);
}

/** Creates a consent request and emails the parent an approve/deny link.
 *  Returns null if the server is unreachable -- callers should treat that as
 *  "can't verify approval" rather than proceeding. */
export async function requestConsent(parentEmail: string, childAge: number): Promise<string | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/consent`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parentEmail, childAge }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { id: string };
    await saveConsent({ id: body.id, parentEmail });
    return body.id;
  } catch {
    return null;
  }
}

export async function getConsentStatus(id: string): Promise<ConsentStatus | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/consent/${id}`);
    if (!res.ok) return null;
    const body = (await res.json()) as { status: ConsentStatus };
    return body.status;
  } catch {
    return null;
  }
}
