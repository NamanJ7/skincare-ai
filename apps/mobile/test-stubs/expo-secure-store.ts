/**
 * Test stub for expo-secure-store.
 *
 * The real package ships source vitest's parser cannot handle, and there is no
 * keychain outside the app runtime anyway. Tests that care about the storage
 * contract mock this module explicitly (see
 * src/lib/backend/secure-session-store.test.ts); this stub only keeps the
 * import graph loadable for the many modules that reach it transitively.
 */
export async function getItemAsync(): Promise<string | null> {
  return null;
}

export async function setItemAsync(): Promise<void> {}

export async function deleteItemAsync(): Promise<void> {}
