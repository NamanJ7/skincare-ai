import type {
  Assessment,
  IntakeResponse,
  Routine,
  SafetyAdjustment,
} from "@pore/shared";
import type { ScanSession, StepId } from "@pore/shared/scan";

import { sanitizeAppCopy } from "./app-copy";
import { getSupabase } from "./backend/supabase";

export interface PlanResult {
  assessment: Assessment;
  routine: Routine;
  adjustments: SafetyAdjustment[];
  mode: "ai";
  /**
   * The scan/session id this plan was analyzed from — stamped client-side (the
   * server doesn't return it). Binds the plan to a specific scan so a stale plan
   * from a prior scan can't render as the current attempt's result.
   */
  scanId?: string;
}

/**
 * One quality-validated scan image, bound to its accepted capture. The server
 * re-hashes `data` and matches it against `contentDigest` and the session's
 * capture before the model is ever invoked (see apps/web scan-analysis-guard).
 */
export interface PlanImage {
  /** base64-encoded image bytes (no data: prefix). */
  data: string;
  mediaType?: "image/jpeg" | "image/png" | "image/webp";
  stepId: StepId;
  captureId: string;
  /** SHA-256 hex of the decoded bytes in `data`. */
  contentDigest: string;
}

export interface PlanInput {
  images: PlanImage[];
  intake: IntakeResponse;
  /** Quality-validated session — analysis is fail-closed without it. */
  scanSession: ScanSession;
}

/** Discriminated outcome so callers can tell "no server" from a real failure. */
export type PlanOutcome =
  | { status: "ok"; plan: PlanResult }
  | { status: "unconfigured" } // EXPO_PUBLIC_API_URL unset — no analysis attempted
  | { status: "error"; code?: string; message?: string };

// Set EXPO_PUBLIC_API_URL (e.g. http://192.168.1.20:3000, your dev machine's LAN
// IP) to hit the real pipeline. Analysis is fail-closed: there is no local mock,
// so an unset/unreachable server yields no assessment (the app then falls back to
// an answer-based read that is clearly labeled as such — never a fabricated scan).
const BASE = process.env.EXPO_PUBLIC_API_URL;

/**
 * Whether an analysis backend is configured in this build. Drives honest,
 * conditional privacy copy (photos can be uploaded only when this is true).
 */
export const ANALYSIS_CONFIGURED = !!BASE;

/**
 * Bearer token for the analysis request. /api/plan meters paid model calls per
 * user and rejects unidentified callers, so this is required — not an
 * enhancement. The app holds at least an anonymous Supabase session from boot
 * (see state/session.tsx); `getSession()` refreshes an expired access token
 * before returning it.
 */
async function authHeaders(): Promise<Record<string, string>> {
  const client = getSupabase();
  if (!client) return {};
  try {
    const { data } = await client.auth.getSession();
    const token = data.session?.access_token;
    return token ? { authorization: `Bearer ${token}` } : {};
  } catch {
    // No token: the server will answer 401 and the UI shows its honest
    // "couldn't analyze" fallback rather than a fabricated result.
    return {};
  }
}

export async function fetchPlan(input: PlanInput): Promise<PlanOutcome> {
  if (!BASE) return { status: "unconfigured" };
  // Vision runs (two Opus calls) get more room; RN fetch has no default timeout.
  // Stay comfortably under the server's `maxDuration = 60` (apps/web/app/api/plan/
  // route.ts) so a genuine server-side timeout is always caught by this clean,
  // correctly-labeled abort first — not by an ambiguous connection drop once the
  // platform kills the function, which would otherwise surface as a generic
  // "couldn't analyze" instead of the more accurate "took too long".
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 55_000);
  try {
    const res = await fetch(`${BASE}/api/plan`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        code?: string;
      } | null;
      return { status: "error", code: body?.code, message: body?.error };
    }
    return {
      status: "ok",
      plan: sanitizeAppCopy((await res.json()) as PlanResult),
    };
  } catch (err) {
    // Distinguish our own timeout from a generic network failure so the UI can
    // say "took too long" vs "couldn't analyze".
    if (timedOut)
      return {
        status: "error",
        code: "timeout",
        message: "Analysis timed out.",
      };
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Network error",
    };
  } finally {
    clearTimeout(timer);
  }
}

/** Outcome of a server-side account deletion. Never optimistic. */
export type DeleteAccountOutcome =
  | { status: "ok" }
  | { status: "unconfigured" }
  | { status: "error"; code?: string; message?: string };

/**
 * Delete the signed-in account server-side.
 *
 * The server derives the identity from the bearer token alone, so there is
 * deliberately no user id in this body — there is nothing here for a caller to
 * tamper with. The caller must not clear local data until this resolves `ok`:
 * wiping the phone while the cloud copy survives is the one outcome the whole
 * flow exists to prevent.
 */
export async function deleteAccount(): Promise<DeleteAccountOutcome> {
  if (!BASE) return { status: "unconfigured" };
  const headers = await authHeaders();
  if (!headers.authorization) {
    return { status: "error", code: "UNAUTHENTICATED" };
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, 30_000);
  try {
    const res = await fetch(`${BASE}/api/account`, {
      method: "DELETE",
      headers,
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        code?: string;
      } | null;
      return { status: "error", code: body?.code, message: body?.error };
    }
    return { status: "ok" };
  } catch (err) {
    if (timedOut)
      return {
        status: "error",
        code: "timeout",
        message: "The deletion request timed out.",
      };
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Network error",
    };
  } finally {
    clearTimeout(timer);
  }
}
