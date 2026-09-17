import type { Assessment, IntakeResponse, PhotoQuality, Routine, SafetyAdjustment } from "@pore/shared";

export interface PlanResult {
  assessment: Assessment;
  routine: Routine;
  adjustments: SafetyAdjustment[];
  mode: "ai" | "mock";
}

export interface PlanInput {
  images: { data: string; mediaType?: string; quality?: PhotoQuality }[];
  intake: IntakeResponse;
}

/**
 * Why a plan request failed, in terms the UI can act on.
 *
 * `fetchPlan` used to return `null` for every kind of failure, which left the
 * caller unable to tell "you are offline, try again in a minute" from "that
 * request was rejected and will be rejected again". Onboarding answered that
 * ambiguity by ignoring it and navigating on regardless, so a failed plan
 * looked exactly like a successful one.
 *
 * The only thing the person staring at the spinner needs to know is whether
 * trying again could work.
 */
export type PlanErrorKind = "offline" | "busy" | "rejected" | "unknown";

export interface PlanError {
  kind: PlanErrorKind;
  /** Copy written for the person waiting, not for a log. */
  message: string;
  retryable: boolean;
}

export type PlanOutcome = { ok: true; plan: PlanResult } | { ok: false; error: PlanError };

// Set EXPO_PUBLIC_API_URL (e.g. http://192.168.1.20:3000, your dev machine's LAN
// IP) to hit the real pipeline. When unset the app has no server to talk to.
const BASE = process.env.EXPO_PUBLIC_API_URL;

/** Longer than the server's own 60s ceiling needs, short enough not to hang forever. */
const TIMEOUT_MS = 75_000;

const OFFLINE: PlanError = {
  kind: "offline",
  message:
    "We couldn't reach Pore just now. Your answers and photos are saved on this phone, so nothing is lost.",
  retryable: true,
};

export async function fetchPlan(input: PlanInput): Promise<PlanOutcome> {
  if (!BASE) return { ok: false, error: OFFLINE };

  try {
    const res = await fetch(`${BASE}/api/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (!res.ok) return { ok: false, error: errorForStatus(res.status) };
    return { ok: true, plan: (await res.json()) as PlanResult };
  } catch {
    // Network failure, DNS, or the timeout above. All the same to the user.
    return { ok: false, error: OFFLINE };
  }
}

function errorForStatus(status: number): PlanError {
  if (status === 429 || status === 503 || status === 529) {
    return {
      kind: "busy",
      message: "Pore is busy right now. Give it a moment and try again.",
      retryable: true,
    };
  }
  if (status >= 400 && status < 500) {
    return {
      kind: "rejected",
      message: "Something about those photos didn't go through. Retaking your set usually fixes it.",
      retryable: false,
    };
  }
  return {
    kind: "unknown",
    message: "Something went wrong building your routine. Trying again usually works.",
    retryable: true,
  };
}
