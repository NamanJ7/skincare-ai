import type { IntakeResponse, PhotoQuality, PlanResult } from "@pore/shared";

export type { PlanResult };

export interface PlanInput {
  images: { data: string; mediaType?: string; quality?: PhotoQuality }[];
  intake: IntakeResponse;
}

/**
 * Why the request did not produce a plan.
 *
 * These used to be one `null`. Collapsing them meant the app could not tell
 * "no server configured, you are in demo mode" apart from "your upload failed",
 * so it told the user neither and navigated on as if nothing had happened.
 */
export type PlanFailure =
  /** `EXPO_PUBLIC_API_URL` is unset — this build has no pipeline to call. */
  | "unconfigured"
  /** The request never reached the server, or the connection dropped. */
  | "offline"
  /** We gave up waiting. */
  | "timeout"
  /** The server answered, and the answer was an error. */
  | "server";

export type PlanOutcome = { ok: true; plan: PlanResult } | { ok: false; reason: PlanFailure };

/** What to tell the user, and what they can do about it. */
export const PLAN_FAILURE_COPY: Record<PlanFailure, string> = {
  unconfigured:
    "This build isn't connected to the analysis service, so there's no reading to give you yet.",
  offline:
    "We couldn't reach the analysis service. Check your connection and try again — your photos are saved on this phone either way.",
  timeout:
    "Reading your skin took longer than expected and we stopped waiting. Your photos are safe — try again.",
  server:
    "Something went wrong on our side while reading your photos. Nothing about your skin was saved. Try again in a moment.",
};

// Set EXPO_PUBLIC_API_URL (e.g. http://192.168.1.20:3000, your dev machine's LAN
// IP) to hit the real pipeline.
const BASE = process.env.EXPO_PUBLIC_API_URL;

/**
 * Long enough for two Opus calls (the route declares `maxDuration = 60`), short
 * enough that a stalled connection cannot leave the user on a spinner forever —
 * which is exactly what a bare `fetch` with no signal used to do.
 */
const TIMEOUT_MS = 45_000;

export async function fetchPlan(input: PlanInput, signal?: AbortSignal): Promise<PlanOutcome> {
  if (!BASE) return { ok: false, reason: "unconfigured" };

  // Two reasons to stop waiting, and the user needs different copy for each, so
  // the deadline is tracked rather than inferred from the abort.
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener("abort", abort);
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE}/api/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal: controller.signal,
    });
    if (!res.ok) return { ok: false, reason: "server" };
    return { ok: true, plan: (await res.json()) as PlanResult };
  } catch {
    if (timedOut) return { ok: false, reason: "timeout" };
    // A caller-driven abort (the user left the screen) is not a failure to
    // report — but it is not a plan either, so it reads as offline and the
    // caller discards it along with the unmounted screen.
    return { ok: false, reason: "offline" };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", abort);
  }
}
