/**
 * In-memory draft for the multi-screen check-in flow, mirroring
 * scan-session.ts: answers travel between screens here and only enter the
 * persisted store once, when wrap-up saves the finished entry.
 */
import type { AdherenceFeel, BreakoutsLevel, IrritationSign, SkinFeel } from "./check-in";

export interface CheckInDraft {
  skinFeel?: SkinFeel;
  breakouts?: BreakoutsLevel;
  irritationSigns?: IrritationSign[];
  followedRoutine?: AdherenceFeel;
  /** Temp camera URI; persisted to the photos dir only on finish. */
  photoUri?: string;
  note?: string;
}

let draft: CheckInDraft = {};

export function getDraft(): CheckInDraft {
  return draft;
}

export function updateDraft(patch: CheckInDraft): void {
  draft = { ...draft, ...patch };
}

export function clearDraft(): void {
  draft = {};
}
