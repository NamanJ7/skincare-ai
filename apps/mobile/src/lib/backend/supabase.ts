/**
 * Supabase client boundary. Mirrors the ANALYSIS_CONFIGURED pattern in
 * lib/api.ts: when the env vars are unset this build has no backend, every
 * consumer must no-op, and the UI keeps its honest "sync is not enabled"
 * copy. Nothing in this module ever fakes a session or a write.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { secureSessionStore } from "./secure-session-store";

const URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Whether an account backend is configured in this build. Drives the real
 * sign-in/sign-up forms vs. the honest placeholder screens.
 */
export const BACKEND_CONFIGURED = !!URL && !!ANON_KEY;

let client: SupabaseClient | null = null;

/** Lazy singleton; null when the backend is not configured. */
export function getSupabase(): SupabaseClient | null {
  if (!URL || !ANON_KEY) return null;
  if (!client) {
    client = createClient(URL, ANON_KEY, {
      auth: {
        // Keychain/Keystore, not AsyncStorage: the refresh token is a
        // long-lived credential and AsyncStorage is plaintext and backed up.
        storage: secureSessionStore,
        autoRefreshToken: true,
        persistSession: true,
        // Mobile deep links are handled by expo-router, not URL fragments.
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
