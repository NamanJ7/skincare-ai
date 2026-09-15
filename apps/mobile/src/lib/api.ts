import type {
  Assessment,
  IntakeResponse,
  PhotoQuality,
  Routine,
  SafetyAdjustment,
} from "@pore/shared";

export interface PlanResult {
  assessment: Assessment;
  routine: Routine;
  adjustments: SafetyAdjustment[];
  mode: "ai" | "mock";
}

export interface PlanInput {
  images: {
    data: string;
    mediaType?: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
    /** What the on-device capture gate measured, so the model can weight the shot. */
    quality?: PhotoQuality;
  }[];
  intake: IntakeResponse;
}

/**
 * The three ways asking for a plan can end.
 *
 * "unconfigured" and "failed" are kept apart on purpose. The first is a dev
 * build with no server pointed at it; the second is a user who asked for a read
 * of their skin and did not get one. Collapsing them is how the app ends up
 * quietly showing an example routine as though it were a real result.
 */
export type PlanOutcome =
  | { status: "ok"; plan: PlanResult }
  | { status: "unconfigured" }
  | { status: "failed"; message: string };

// Set EXPO_PUBLIC_API_URL (e.g. http://192.168.1.20:3000, your dev machine's LAN
// IP) to hit the real pipeline. When unset, the app runs its local safety-engine
// demo instead — clearly labelled as one.
const BASE = process.env.EXPO_PUBLIC_API_URL;

export async function fetchPlan(input: PlanInput): Promise<PlanOutcome> {
  if (!BASE) return { status: "unconfigured" };
  try {
    const res = await fetch(`${BASE}/api/plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      return {
        status: "failed",
        message:
          res.status >= 500
            ? "Something went wrong on our side while reading your photos."
            : "We couldn't build your routine from those photos.",
      };
    }
    return { status: "ok", plan: (await res.json()) as PlanResult };
  } catch {
    return { status: "failed", message: "We couldn't reach the server. Check your connection." };
  }
}
