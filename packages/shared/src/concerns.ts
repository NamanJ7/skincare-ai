/**
 * Display labels for the nine concern keys.
 *
 * Runtime metadata about the domain, in the same spirit as `ACTIVES` in
 * `safety/ingredients.ts`: one table, shared by every surface that has to name a
 * concern, so the wording cannot drift between screens.
 *
 * The phrasing is deliberately cosmetic. "Acne-like breakouts", not "acne";
 * "dark-spot appearance", not "hyperpigmentation". The assessment prompt works
 * under the same constraint and the two must agree.
 */
import type { ConcernKey } from "./types/assessment";

export const CONCERN_LABELS: Record<ConcernKey, string> = {
  acne_like_breakouts: "Acne-like breakouts",
  oiliness: "Oiliness",
  dryness_flaking: "Dryness / flaking",
  texture_congestion: "Texture & congestion",
  uneven_tone: "Uneven tone",
  dark_spot_appearance: "Dark-spot appearance",
  redness_appearance: "Redness appearance",
  fine_line_appearance: "Fine-line appearance",
  irritation_signs: "Signs of irritation",
};
