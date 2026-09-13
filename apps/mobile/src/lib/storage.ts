/**
 * Thin persistence layer over AsyncStorage. State in React contexts is the
 * source of truth; storage is a write-through mirror. Writes resolve to a
 * boolean so critical transitions can wait for durable persistence, while
 * existing best-effort callers may continue to ignore the returned promise.
 * Swapping to Supabase later means re-implementing these four functions.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

const VERSION = 1;

/** Envelope schema version, for modules that reassemble envelopes (cloud sync). */
export const STORAGE_VERSION = VERSION;

const KEYS = {
  profile: "pore/profile",
  log: "pore/log",
  entitlement: "pore/entitlement",
  checkins: "pore/checkins",
  scans: "pore/scans",
  reminders: "pore/reminders",
  appearance: "pore/appearance",
} as const;

export type StoreKey = keyof typeof KEYS;

interface Envelope<T> {
  v: number;
  data: T;
}

/**
 * Optional write-observer for cloud sync (same registration pattern as
 * setAnalyticsSink). Local storage remains the source of truth: the mirror is
 * notified after a successful local write, fire-and-forget, and can never
 * fail or delay the write it observes. clearAll() intentionally does NOT
 * notify — account deletion is an explicit flow, never an implicit sync.
 */
export interface StorageMirror {
  save(key: StoreKey, envelope: { v: number; data: unknown }): void;
  remove(key: StoreKey): void;
}

let mirror: StorageMirror | undefined;

export function setStorageMirror(next: StorageMirror | undefined): void {
  mirror = next;
}

/** Returns null for missing keys, parse errors, or unknown schema versions. */
export async function load<T>(key: StoreKey): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(KEYS[key]);
    if (!raw) return null;
    const env = JSON.parse(raw) as Envelope<T>;
    // v1 policy: discard anything we don't recognize rather than crash on it.
    return env.v === VERSION ? env.data : null;
  } catch {
    return null;
  }
}

export async function save<T>(key: StoreKey, data: T): Promise<boolean> {
  try {
    const env: Envelope<T> = { v: VERSION, data };
    await AsyncStorage.setItem(KEYS[key], JSON.stringify(env));
    try {
      mirror?.save(key, env);
    } catch {
      // The mirror is best-effort by contract; a sync failure never fails a save.
    }
    return true;
  } catch {
    return false;
  }
}

export async function remove(key: StoreKey): Promise<boolean> {
  try {
    await AsyncStorage.removeItem(KEYS[key]);
    try {
      mirror?.remove(key);
    } catch {
      // Best-effort, as above.
    }
    return true;
  } catch {
    return false;
  }
}

export async function clearAll(): Promise<boolean> {
  try {
    await AsyncStorage.multiRemove([
      ...Object.values(KEYS),
      // The analytics outbox is intentionally separate from product state, but
      // a user-facing delete must remove observational data as well.
      "pore/analytics-outbox",
    ]);
    return true;
  } catch {
    return false;
  }
}
