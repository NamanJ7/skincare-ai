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
