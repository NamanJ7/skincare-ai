import {
  onboardingHrefForStep,
  requiredOnboardingStep,
  type RequiredOnboardingStep,
} from "./onboarding-readiness";
import type { OnboardingData } from "@/state/onboarding";

const ONBOARDING_ORDER: readonly RequiredOnboardingStep[] = [
  "age",
  "goal",
  "skin-profile",
  "sensitivity",
  "safety",
  "scan",
  "preview",
];

const ALWAYS_PUBLIC = new Set(["index", "(auth)", "legal"]);

/**
 * Routes that render for anyone, at any point, regardless of age tier or how
 * much of onboarding is done.
 *
 * The legal documents are the reason this is shared rather than inlined in one
 * gate. The youth-consent screens ask a reader to "Read the full Privacy
 * Notice" *before* consent exists — and there are two independent gates in
 * front of that link: the age-policy redirect in the root layout, and
 * `incompleteOnboardingRedirect` below. Teaching only one of them about
 * `/legal` leaves the link just as dead as the unregistered URL it replaced.
 * The documents are read-only and carry no personalization, so neither gate
 * has anything to protect here.
 */
export function isAlwaysPublicRoute(segments: readonly string[]): boolean {
  return ALWAYS_PUBLIC.has(segments[0] ?? "index");
}
const EDUCATION_ROUTES = new Set(["intro", "age-restricted"]);

/**
 * Return a safe redirect for a deep link, or null when the current route may
 * render. Age/guardian authorization is deliberately handled by the stronger
 * policy gate in the root layout before this helper runs.
 */
export function incompleteOnboardingRedirect(
  data: OnboardingData,
  segments: readonly string[],
): string | null {
  const required = requiredOnboardingStep(data);
  if (!required) return null;

  const root = segments[0] ?? "index";
  if (isAlwaysPublicRoute(segments)) return null;

  if (root === "onboarding") {
    const screen = segments[1];
    if (!screen || EDUCATION_ROUTES.has(screen)) return null;
    if (screen === "parent-consent" || screen === "teen-consent") return null;
    // Both the answers-only path and a validated scan pass through this
    // transient screen, which records the attempt before Preview is eligible.
    // Recording the attempt flips `required` from "scan" to "preview" while
    // still on this screen (its own effect hasn't navigated yet) — excusing
    // only "scan" here let the root redirect race that effect to the next
    // route, thrashing the router into "Maximum update depth exceeded".
    if (
      screen === "generating" &&
      (required === "scan" || required === "preview")
    ) {
      return null;
    }
    // Notifications is the optional handoff immediately after Preview. At
    // this point `onboardingComplete` is intentionally still false so the
    // choice and its completion write can be committed together.
    if (screen === "notifications" && required === "preview") return null;
    const current = ONBOARDING_ORDER.indexOf(
      screen as RequiredOnboardingStep,
    );
    const needed = ONBOARDING_ORDER.indexOf(required);
    // Earlier questions stay reachable for Back/edit. Future steps do not.
    if (current >= 0 && current <= needed) return null;
  }

  if (root === "scan-flow" && required === "scan") return null;
  return onboardingHrefForStep(required);
}

/**
 * In-app destinations a `returnTo` / `next` route param may name.
 *
 * The previous check was `value.startsWith("/")`, which also accepts
 * `//evil.com` — a protocol-relative URL. On native that is a dead route, but
 * the app also builds for web (expo-router's web adapter resolves hrefs through
 * the DOM), and "it happens to be inert on this platform" is not a property
 * worth relying on. An allowlist is exact, and these params only ever carry one
 * of a handful of literals anyway (see onboarding/age.tsx, onboarding/preview.tsx,
 * scan-flow/review.tsx).
 */
const RETURNABLE_ROUTES: readonly string[] = [
  "/(tabs)",
  "/(tabs)/profile",
  "/(tabs)/progress",
  "/(tabs)/routine",
  "/(tabs)/scan",
  "/(tabs)/shelf",
  "/onboarding/preview",
  "/onboarding/generating",
  "/onboarding/notifications",
  "/scan-flow",
  ...ONBOARDING_ORDER.filter((step) => step !== "scan").map(
    (step) => `/onboarding/${step}`,
  ),
];

/**
 * Validate a route param against {@link RETURNABLE_ROUTES}, returning `fallback`
 * for anything unrecognised. The query string is preserved but plays no part in
 * the decision — only the path is matched.
 */
export function safeInternalHref(
  value: string | undefined,
  fallback: string,
): string {
  if (typeof value !== "string" || !value.startsWith("/")) return fallback;
  // Rejects `//evil.com` and `/\evil.com`, both of which browsers treat as
  // protocol-relative rather than as a path.
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback;
  const path = value.split(/[?#]/)[0] ?? "";
  return RETURNABLE_ROUTES.includes(path) ? value : fallback;
}
