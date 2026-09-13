/**
 * Keychain-backed session storage for the Supabase auth client.
 *
 * Supabase's default is AsyncStorage, which on iOS is an unencrypted file in
 * the app container that is included in iCloud/iTunes backups. It holds the
 * access token *and* the long-lived refresh token — the credential that can
 * mint new access tokens indefinitely. For an app that also holds face photos
 * and health-adjacent answers, that is the wrong place for it.
 *
 * expo-secure-store puts values in the iOS Keychain / Android Keystore instead.
 * Two wrinkles it does not handle on its own, both solved here:
 *
 *   1. **Size.** SecureStore warns above ~2048 bytes and can fail outright.
 *      A Supabase session (two JWTs plus the user object) routinely exceeds
 *      that, so values are split across numbered chunk keys.
 *   2. **Migration.** Existing installs already have a session in AsyncStorage.
 *      Reading falls back to it once, re-writes into SecureStore, and clears
 *      the plaintext copy — so upgrading does not sign anyone out, and the old
 *      copy does not linger.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

/**
 * Comfortably under SecureStore's ~2048-byte practical limit, leaving room for
 * the key name and platform overhead.
 */
const CHUNK_SIZE = 1536;

/** How many chunks one value may span. 32 × 1536 ≈ 48 KB, far above any session. */
const MAX_CHUNKS = 32;

/**
 * SecureStore keys must be alphanumeric plus `.`, `-`, `_`. Supabase keys look
 * like `sb-<ref>-auth-token`, which is already safe, but a key it does not
 * accept would throw on every read and present as "signed out at random".
 */
function safeKey(key: string): string {
  return key.replace(/[^A-Za-z0-9._-]/g, "_");
}

function chunkKey(key: string, index: number): string {
  return `${safeKey(key)}.${index}`;
}

async function clearChunks(key: string, from = 0): Promise<void> {
  for (let i = from; i < MAX_CHUNKS; i++) {
    try {
      await SecureStore.deleteItemAsync(chunkKey(key, i));
    } catch {
      // Nothing stored under this index, or the keychain is unavailable.
    }
  }
}

async function readChunks(key: string): Promise<string | null> {
  let out = "";
  for (let i = 0; i < MAX_CHUNKS; i++) {
    const part = await SecureStore.getItemAsync(chunkKey(key, i));
    if (part == null) break;
    out += part;
  }
  return out.length > 0 ? out : null;
}

async function writeChunks(key: string, value: string): Promise<void> {
  const total = Math.ceil(value.length / CHUNK_SIZE);
  if (total > MAX_CHUNKS) {
    throw new Error("session value exceeds secure storage capacity");
  }
  for (let i = 0; i < total; i++) {
    await SecureStore.setItemAsync(
      chunkKey(key, i),
      value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
    );
  }
  // Drop any tail left by a previously longer value, or a stale read would
  // concatenate old bytes onto the new session and fail to parse.
  await clearChunks(key, total);
}

/**
 * The storage interface Supabase's auth client expects. Every method is
 * best-effort: a keychain failure must present as "signed out", never as an
 * unhandled rejection during hydration (which surfaces as a red screen before
 * the app has drawn anything).
 */
export const secureSessionStore = {
  async getItem(key: string): Promise<string | null> {
    try {
      const stored = await readChunks(key);
      if (stored != null) return stored;
    } catch {
      // Fall through to the migration path rather than failing the read.
    }

    // One-time migration off AsyncStorage. Only reached when SecureStore holds
    // nothing for this key, so it cannot clobber a newer secure value.
    try {
      const legacy = await AsyncStorage.getItem(key);
      if (legacy == null) return null;
      try {
        await writeChunks(key, legacy);
        // Only remove the plaintext copy once the secure write succeeded.
        await AsyncStorage.removeItem(key);
      } catch {
        // Keep the legacy copy: losing it here would sign the user out.
      }
      return legacy;
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      await writeChunks(key, value);
      // Belt and braces: an install that migrated mid-write could otherwise
      // leave a stale plaintext session behind.
      await AsyncStorage.removeItem(key).catch(() => {});
    } catch {
      // Never throw into the auth client's write path.
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await clearChunks(key);
    } catch {
      // As above.
    }
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // As above.
    }
  },
};
