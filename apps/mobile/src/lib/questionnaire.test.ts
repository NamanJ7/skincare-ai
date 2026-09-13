import { describe, expect, it } from "vitest";

import {
  CORE_QUESTION_CONTRACT,
  answersForRankedGoals,
  isSafetyAnswerComplete,
  normalizeSafetyChoiceIds,
  safetyChoicesFromLegacyAnswers,
  toggleSafetyChoice,
  toggleRankedGoal,
} from "./questionnaire";

describe("core questionnaire contract", () => {
  it("documents a consumer and a concrete decision for every retained question", () => {
    expect(CORE_QUESTION_CONTRACT).toHaveLength(9);
    expect(new Set(CORE_QUESTION_CONTRACT.map((item) => item.id)).size).toBe(
      CORE_QUESTION_CONTRACT.length,
    );
    for (const question of CORE_QUESTION_CONTRACT) {
      expect(question.fields.length).toBeGreaterThan(0);
      expect(question.consumer.length).toBeGreaterThan(0);
      expect(question.expectedDecision.length).toBeGreaterThan(0);
    }
  });
});

describe("ranked goals", () => {
  it("keeps tap order, caps concrete concerns at three, and supports reranking by removal", () => {
    let selected: string[] = [];
    selected = toggleRankedGoal(selected, "marks");
    selected = toggleRankedGoal(selected, "acne");
    selected = toggleRankedGoal(selected, "texture");
    expect(toggleRankedGoal(selected, "dry")).toEqual(selected);

    selected = toggleRankedGoal(selected, "marks");
    expect(selected).toEqual(["acne", "texture"]);
    selected = toggleRankedGoal(selected, "dry");
    expect(selected).toEqual(["acne", "texture", "dry"]);
  });

  it("treats not-sure as exclusive and replaces it with a concrete concern", () => {
    expect(toggleRankedGoal(["acne", "texture"], "unsure")).toEqual(["unsure"]);
    expect(toggleRankedGoal(["unsure"], "dry")).toEqual(["dry"]);
  });

  it("maps ordered choices to a primary goal and deduplicated engine goals", () => {
    expect(answersForRankedGoals(["marks", "dry", "acne"])).toEqual({
      primaryGoal: "post_acne_marks",
      goalChoiceIds: ["marks", "dry", "acne"],
      goals: [
        "post_acne_marks",
        "hyperpigmentation",
        "dryness",
        "redness",
        "acne",
      ],
    });
    expect(answersForRankedGoals([])).toBeNull();
  });
});

describe("explicit safety choices", () => {
  it("keeps none exclusive and clears it when a real flag is selected", () => {
    expect(toggleSafetyChoice(["known_reactions"], "none")).toEqual(["none"]);
    expect(toggleSafetyChoice(["none"], "prescription_skincare")).toEqual([
      "prescription_skincare",
    ]);
    expect(
      normalizeSafetyChoiceIds(["none", "known_reactions", "bad"]),
    ).toEqual(["known_reactions"]);
  });

  it("maps complete legacy fields without inventing partial answers", () => {
    expect(
      safetyChoicesFromLegacyAnswers({
        pregnancyOrBreastfeeding: false,
        usingPrescriptionSkincare: false,
        allergies: [],
        currentProducts: [],
      }),
    ).toEqual(["none"]);
    expect(
      safetyChoicesFromLegacyAnswers({
        pregnancyOrBreastfeeding: true,
        usingPrescriptionSkincare: false,
        allergies: ["fragrance"],
        currentProducts: ["retinoid"],
      }),
    ).toEqual([
      "pregnancy_or_breastfeeding",
      "known_reactions",
      "current_strong_actives",
    ]);
    expect(safetyChoicesFromLegacyAnswers({ allergies: [] })).toBeUndefined();
  });

  it("requires conditional details and agreement with stored safety fields", () => {
    expect(
      isSafetyAnswerComplete({
        safetyChoiceIds: ["known_reactions"],
        pregnancyOrBreastfeeding: false,
        usingPrescriptionSkincare: false,
        allergies: [],
        currentProducts: [],
      }),
    ).toBe(false);
    expect(
      isSafetyAnswerComplete({
        safetyChoiceIds: ["known_reactions", "current_strong_actives"],
        pregnancyOrBreastfeeding: false,
        usingPrescriptionSkincare: false,
        allergies: ["fragrance"],
        currentProducts: ["retinoid"],
      }),
    ).toBe(true);
    expect(
      isSafetyAnswerComplete({
        safetyChoiceIds: ["none"],
        pregnancyOrBreastfeeding: false,
        usingPrescriptionSkincare: false,
        allergies: [],
        currentProducts: [],
      }),
    ).toBe(true);
  });
});
