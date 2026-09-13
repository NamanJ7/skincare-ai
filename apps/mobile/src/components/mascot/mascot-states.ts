export type MascotState =
  | "neutral"
  | "guiding"
  | "observing"
  | "encouraging"
  | "celebrating"
  | "caution"
  | "resting"
  | "empty";

export type MascotEyes = "open" | "soft" | "wide" | "closed";

export interface MascotStateVisual {
  tilt: number;
  bob: number;
  eyes: MascotEyes;
}

/**
 * Visual direction only. Guidance and safety meaning always stays in nearby
 * text; the mascot never becomes the sole way a state is communicated.
 */
export const MASCOT_STATES: Record<MascotState, MascotStateVisual> = {
  neutral: {
    tilt: 0,
    bob: 2,
    eyes: "open",
  },
  guiding: {
    tilt: -3,
    bob: 3,
    eyes: "wide",
  },
  observing: {
    tilt: 2,
    bob: 2,
    eyes: "soft",
  },
  encouraging: {
    tilt: -2,
    bob: 3,
    eyes: "soft",
  },
  celebrating: {
    tilt: -5,
    bob: 5,
    eyes: "soft",
  },
  caution: {
    tilt: 0,
    bob: 1,
    eyes: "wide",
  },
  resting: {
    tilt: 3,
    bob: 1,
    eyes: "closed",
  },
  empty: {
    tilt: 0,
    bob: 1,
    eyes: "soft",
  },
};

export const MASCOT_STATE_LABELS: Record<MascotState, string> = {
  neutral: "neutral",
  guiding: "offering guidance",
  observing: "observing",
  encouraging: "encouraging",
  celebrating: "celebrating a milestone",
  caution: "sharing a caution",
  resting: "resting",
  empty: "waiting for your first entry",
};
