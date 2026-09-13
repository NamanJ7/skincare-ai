/** Copy for the single replay-only visual explainer. */
export const ONBOARDING_ROUTES = {
  age: "/onboarding/age",
  goal: "/onboarding/goal",
  preview: "/onboarding/preview",
  notifications: "/onboarding/notifications",
  profile: "/(tabs)/profile",
  explainer: "/onboarding/intro?replay=1",
} as const;

export const TOUR_BEATS = [
  {
    id: "guided-photo",
    label: "Guided photo",
    body: "Pore checks framing, angle, light, and sharpness before analysis.",
    icon: "scan-outline",
  },
  {
    id: "cosmetic-context",
    label: "Cosmetic context",
    body: "Quality-checked photos can add visible-skin context to your answers.",
    icon: "sparkles-outline",
  },
  {
    id: "safety-adjusted-routine",
    label: "Safety-adjusted routine",
    body: "Your goals, sensitivity, reactions, and treatments set the pace.",
    icon: "shield-checkmark-outline",
  },
] as const;
