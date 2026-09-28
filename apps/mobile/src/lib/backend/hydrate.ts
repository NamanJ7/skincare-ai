/**
 * Cold-start cloud fill: for store keys that are empty locally (fresh install
 * or new device), pull the signed-in user's cloud snapshots and cache them
 * back to local storage. Local data always wins when present — this only
 * fills gaps, so a device's own writes can never be clobbered by a stale
 * cloud copy. Hard-capped so a slow network can't hold the splash screen.
 */
import { save, STORAGE_VERSION, type StoreKey } from "../storage";
import { pullAll } from "./cloud-store";
import { getSupabase } from "./supabase";

const PULL_TIMEOUT_MS = 3000;

export async function pullMissingSnapshots(
  missing: StoreKey[],
): Promise<Partial<Record<StoreKey, unknown>>> {
  if (missing.length === 0) return {};
  const client = getSupabase();
  if (!client) return {};
  try {
    // The deadline has to cover `getSession()` too, not just `pullAll`.
    // `getSession()` refreshes the token over the network, so an unreachable
    // auth host would otherwise never resolve — and this call sits in front of
    // the splash screen, which stays pinned until it settles.
    const envelopes = await Promise.race([
      (async () => {
        const { data } = await client.auth.getSession();
        const userId = data.session?.user?.id;
        if (!userId) return {};
        return await pullAll(client, userId);
      })(),
      new Promise<ReturnType<typeof Object.create>>((resolve) =>
        setTimeout(() => resolve({}), PULL_TIMEOUT_MS),
      ),
    ]);

    const result: Partial<Record<StoreKey, unknown>> = {};
    for (const key of missing) {
      const envelope = envelopes[key];
      // Same version policy as load(): discard shapes we don't recognize.
      if (envelope && envelope.v === STORAGE_VERSION && envelope.data != null) {
        result[key] = envelope.data;
        // Cache locally so the next cold start works offline.
        void save(key, envelope.data);
      }
    }
    return result;
  } catch {
    return {};
  }
}
