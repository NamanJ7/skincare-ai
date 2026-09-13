/**
 * The session store holds the refresh token — the credential that mints access
 * tokens indefinitely. Two failure modes matter more than the happy path:
 *   - a value larger than SecureStore's ~2 KB limit must round-trip, not truncate
 *   - an existing AsyncStorage session must survive the migration, because the
 *     alternative is silently signing every existing install out on upgrade
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const keychain = new Map<string, string>();
const asyncStore = new Map<string, string>();

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => keychain.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    // Mirror the real limit so an un-chunked write would fail here too.
    if (value.length > 2048) throw new Error("value too large for SecureStore");
    keychain.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    keychain.delete(key);
  }),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => asyncStore.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      asyncStore.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      asyncStore.delete(key);
    }),
  },
}));

const { secureSessionStore } = await import("./secure-session-store");

const KEY = "sb-project-auth-token";

/** Roughly the shape and size of a real Supabase session envelope. */
function session(marker: string, size = 6_000): string {
  return JSON.stringify({ marker, access_token: "a".repeat(size) });
}

beforeEach(async () => {
  keychain.clear();
  asyncStore.clear();
  // clearAllMocks only clears calls, not implementations — a mockRejectedValue
  // from a previous test would otherwise leak into the next one.
  vi.clearAllMocks();
  const store = await import("expo-secure-store");
  vi.mocked(store.getItemAsync).mockImplementation(
    async (key: string) => keychain.get(key) ?? null,
  );
  vi.mocked(store.setItemAsync).mockImplementation(
    async (key: string, value: string) => {
      if (value.length > 2048) throw new Error("value too large for SecureStore");
      keychain.set(key, value);
    },
  );
  vi.mocked(store.deleteItemAsync).mockImplementation(async (key: string) => {
    keychain.delete(key);
  });
});

describe("secureSessionStore", () => {
  it("round-trips a value far larger than the SecureStore item limit", async () => {
    const value = session("large");
    expect(value.length).toBeGreaterThan(2048);

    await secureSessionStore.setItem(KEY, value);

    expect(await secureSessionStore.getItem(KEY)).toBe(value);
    // Proof it actually chunked rather than storing one oversized item.
    expect(keychain.size).toBeGreaterThan(1);
  });

  it("returns null when nothing is stored", async () => {
    expect(await secureSessionStore.getItem(KEY)).toBeNull();
  });

  it("removes every chunk, leaving no partial session behind", async () => {
    await secureSessionStore.setItem(KEY, session("gone"));
    await secureSessionStore.removeItem(KEY);

    expect(await secureSessionStore.getItem(KEY)).toBeNull();
    expect(keychain.size).toBe(0);
  });

  it("does not concatenate a longer previous value onto a shorter new one", async () => {
    await secureSessionStore.setItem(KEY, session("old", 9_000));
    const shorter = session("new", 100);
    await secureSessionStore.setItem(KEY, shorter);

    // A stale tail chunk would make this parse as garbage and log the user out.
    expect(await secureSessionStore.getItem(KEY)).toBe(shorter);
    expect(JSON.parse((await secureSessionStore.getItem(KEY))!).marker).toBe("new");
  });

  it("migrates an existing AsyncStorage session without signing the user out", async () => {
    const legacy = session("legacy");
    asyncStore.set(KEY, legacy);

    // The value the auth client sees must be the legacy session, unchanged.
    expect(await secureSessionStore.getItem(KEY)).toBe(legacy);
    // And it must now live in the keychain, with the plaintext copy gone.
    expect(asyncStore.has(KEY)).toBe(false);
    expect(await secureSessionStore.getItem(KEY)).toBe(legacy);
  });

  it("keeps the legacy copy when the secure write fails, rather than losing the session", async () => {
    const store = await import("expo-secure-store");
    vi.mocked(store.setItemAsync).mockRejectedValue(new Error("keychain locked"));
    const legacy = session("legacy");
    asyncStore.set(KEY, legacy);

    expect(await secureSessionStore.getItem(KEY)).toBe(legacy);
    // Deleting it here would strand the user with no session at all.
    expect(asyncStore.get(KEY)).toBe(legacy);
  });

  it("prefers the secure value over a stale legacy one", async () => {
    await secureSessionStore.setItem(KEY, session("secure"));
    asyncStore.set(KEY, session("stale"));

    const read = await secureSessionStore.getItem(KEY);
    expect(JSON.parse(read!).marker).toBe("secure");
  });

  it("never throws out of setItem when the keychain is unavailable", async () => {
    const store = await import("expo-secure-store");
    vi.mocked(store.setItemAsync).mockRejectedValue(new Error("keychain locked"));

    // An unhandled rejection here surfaces during hydration as a red screen.
    await expect(
      secureSessionStore.setItem(KEY, session("x")),
    ).resolves.toBeUndefined();
  });

  it("never throws out of getItem when the keychain is unavailable", async () => {
    const store = await import("expo-secure-store");
    vi.mocked(store.getItemAsync).mockRejectedValue(new Error("keychain locked"));

    await expect(secureSessionStore.getItem(KEY)).resolves.toBeNull();
  });
});
