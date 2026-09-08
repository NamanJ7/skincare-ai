import type { Assessment, IntakeResponse, Routine, SafetyAdjustment } from "@pore/shared";

export interface PlanResult {
  assessment: Assessment;
  routine: Routine;
  adjustments: SafetyAdjustment[];
  mode: "ai" | "mock";
}

export interface PlanInput {
  images: { data: string; mediaType?: string }[];
  intake: IntakeResponse;
}

// Set EXPO_PUBLIC_API_URL (e.g. http://192.168.1.20:3000, your dev machine's LAN
// IP) to hit the real pipeline. When unset or unreachable, the app falls back to
// its local safety-engine demo so the flow always works.
const BASE = process.env.EXPO_PUBLIC_API_URL;

export async function fetchPlan(input: PlanInput): Promise<PlanResult | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/api/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      // The fallback below is deliberate, but it must not be silent: a rejected
      // request would otherwise render a plausible mock routine with no signal
      // that the real pipeline refused it.
      console.warn(`fetchPlan: ${res.status} from /api/plan`, await res.text());
      return null;
    }
    return (await res.json()) as PlanResult;
  } catch {
    return null;
  }
}

/**
 * Parental consent for 16-17 year olds.
 *
 * Both calls fail closed: an unset EXPO_PUBLIC_API_URL, a network error or any
 * non-ok response returns a failure, never an approval. The screen must treat
 * anything other than `{ ok: true }` as "not approved" — the bug this replaces
 * was a gate that let people through when the check never happened.
 */
export type ConsentResult = { ok: true; token: string } | { ok: false; error: string };

const NO_API =
  "Approval needs a connection to Pore's server, which isn't configured in this build.";

export async function requestParentalConsent(
  parentEmail: string,
  age: 16 | 17,
): Promise<ConsentResult> {
  if (!BASE) return { ok: false, error: NO_API };
  try {
    const res = await fetch(`${BASE}/api/consent/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ parentEmail, age }),
    });
    const data = (await res.json()) as { token?: string; error?: string };
    if (!res.ok || !data.token) {
      return { ok: false, error: data.error ?? "Could not send the email. Try again." };
    }
    return { ok: true, token: data.token };
  } catch {
    return { ok: false, error: "Could not reach Pore's server. Check your connection." };
  }
}

export async function verifyParentalConsent(
  token: string,
  code: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!BASE) return { ok: false, error: NO_API };
  try {
    const res = await fetch(`${BASE}/api/consent/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, code }),
    });
    const data = (await res.json()) as { approved?: boolean; error?: string };
    if (!res.ok || data.approved !== true) {
      return { ok: false, error: data.error ?? "That code is not right." };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: "Could not reach Pore's server. Check your connection." };
  }
}
