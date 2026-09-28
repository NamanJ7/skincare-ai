/**
 * Shelf verdicts: how a product the user owns fits their current plan. Local
 * and deterministic — same conservative knowledge base as the safety engine.
 * Copy stays cosmetic and calm ("protects your barrier"), never medical.
 */
import {
  ACTIVES,
  type ActiveKey,
  type ActiveMeta,
  type IntakeResponse,
  type Routine,
} from "@pore/shared";

import type { UserProduct } from "./profile";

export type ShelfStatus = "earned" | "careful" | "pause" | "unrated";

export interface ShelfVerdict {
  status: ShelfStatus;
  /** Display label: "Earned a spot" / "Use carefully" / "Pause for now" / "Not rated yet". */
  label: string;
  /** Plain-language reasons shown when the row expands. */
  reasons: string[];
}

export const SHELF_STATUS_LABELS: Record<ShelfStatus, string> = {
  earned: "Earned a spot",
  careful: "Use carefully",
  pause: "Pause for now",
  unrated: "Not rated yet",
};

/** Actives that count toward the one-irritant-per-session budget. */
function isSessionIrritant(key: ActiveKey): boolean {
  // Callers include plan steps, whose `active` is server-supplied and may name
  // an ingredient this build doesn't know. Unknown keys are not irritants.
  const meta = ACTIVES[key] as ActiveMeta | undefined;
  return !!meta && (meta.isExfoliatingAcid || meta.isRetinoid || meta.isBenzoylPeroxide);
}

export function shelfVerdict(
  product: UserProduct,
  routine: Routine,
  intake: IntakeResponse,
): ShelfVerdict {
  const actives = product.actives ?? [];

  // No tagged actives = no basis for a verdict. An honest "not rated" beats
  // implying we checked ingredients we never saw.
  if (actives.length === 0) {
    return {
      status: "unrated",
      label: SHELF_STATUS_LABELS.unrated,
      reasons: [
        product.ingredientsUnknown
          ? "You weren't sure about the ingredients. Tag them from the label when you can, and Pore will check them against your plan."
          : "Tag this product's ingredients for a compatibility read against your plan.",
      ],
    };
  }

  const planActives = new Set(
    [...routine.am, ...routine.pm]
      .map((s) => s.active)
      .filter((a): a is ActiveKey => a !== undefined),
  );
  const planIrritants = [...planActives].filter(isSessionIrritant);

  const pause: string[] = [];
  const careful: string[] = [];

  for (const key of actives) {
    const meta = ACTIVES[key];
    if (intake.allergies.includes(key)) {
      pause.push(
        `${meta.label} is on your avoid list. Pausing it protects your skin.`,
      );
      continue;
    }
    if (intake.pregnancyOrBreastfeeding && meta.pregnancySafety === "avoid") {
      pause.push(
        `${meta.label} is usually set aside during pregnancy or breastfeeding.`,
      );
      continue;
    }
    if (!planActives.has(key)) {
      if (isSessionIrritant(key) && planIrritants.length > 0) {
        pause.push(
          `Your plan already includes ${ACTIVES[planIrritants[0]].label}. Layering ${meta.label} on top is more than your skin needs right now.`,
        );
        continue;
      }
      if (meta.isStrongActive && intake.sensitivity === "high") {
        pause.push(
          `${meta.label} is strong for often-sensitive skin. Pausing it protects your barrier.`,
        );
        continue;
      }
    }
    if (intake.pregnancyOrBreastfeeding && meta.pregnancySafety === "caution") {
      careful.push(
        `${meta.label} is best used sparingly during pregnancy or breastfeeding.`,
      );
      continue;
    }
    if (planActives.has(key) && meta.isStrongActive) {
      careful.push(
        `Your plan already uses ${meta.label}. Keep to one product with it per day so you don't double up.`,
      );
      continue;
    }
    if (meta.baseIrritation === "high") {
      careful.push(
        `${meta.label} can be irritating. Introduce it slowly and watch how your skin responds.`,
      );
      continue;
    }
  }

  if (pause.length > 0)
    return {
      status: "pause",
      label: SHELF_STATUS_LABELS.pause,
      reasons: pause,
    };
  if (careful.length > 0)
    return {
      status: "careful",
      label: SHELF_STATUS_LABELS.careful,
      reasons: careful,
    };
  return {
    status: "earned",
    label: SHELF_STATUS_LABELS.earned,
    reasons: ["This works with your current plan. Keep it in the rotation."],
  };
}
