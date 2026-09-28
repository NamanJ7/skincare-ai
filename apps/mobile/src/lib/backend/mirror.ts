/**
 * Debounced cloud mirror: observes successful local writes (via the
 * setStorageMirror seam) and pushes them to Supabase. Installed only when the
 * backend is configured AND a user is signed in; uninstalled on sign-out.
 * Local-first invariant: this module can only ever lag the device, never
 * lead it, and a failed push changes nothing locally.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import { setStorageMirror, type StoreKey } from "../storage";
import {
  pushSnapshot,
  removeSnapshot,
  type CloudEnvelope,
} from "./cloud-store";

const DEBOUNCE_MS = 500;

interface ActiveMirror {
  timers: Map<StoreKey, ReturnType<typeof setTimeout>>;
}

let active: ActiveMirror | null = null;

/**
 * Start mirroring local writes for the signed-in user. Re-installing (e.g.
 * a new session) replaces the previous mirror.
 */
export function installCloudMirror(
  client: SupabaseClient,
  userId: string,
): void {
  uninstallCloudMirror();
  const timers = new Map<StoreKey, ReturnType<typeof setTimeout>>();
  const pending = new Map<StoreKey, CloudEnvelope>();
  active = { timers };

  setStorageMirror({
    save(key, envelope) {
      pending.set(key, envelope);
      const existing = timers.get(key);
      if (existing) clearTimeout(existing);
      timers.set(
        key,
        setTimeout(() => {
          timers.delete(key);
          const latest = pending.get(key);
          pending.delete(key);
          if (latest) void pushSnapshot(client, userId, key, latest);
        }, DEBOUNCE_MS),
      );
    },
    remove(key) {
      const existing = timers.get(key);
      if (existing) {
        clearTimeout(existing);
        timers.delete(key);
      }
      pending.delete(key);
      void removeSnapshot(client, userId, key);
    },
  });
}

/** Stop mirroring and cancel any queued pushes. Safe to call when inactive. */
export function uninstallCloudMirror(): void {
  if (active) {
    for (const timer of active.timers.values()) clearTimeout(timer);
    active = null;
  }
  setStorageMirror(undefined);
}
