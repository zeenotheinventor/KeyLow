import { BROCCOLI_ID, CHICKEN_ID, OIL_ID, RICE_ID, YOGURT_ID } from "./recipeDraftFixtures";

import type { AdjustmentDraft } from "@keylow/core";

// The draft of the board `assistant-card · recipe-compare`: Eval chicken and rice, 30 g more protein a serving at
// the same calories. The foods are the CoFID ones the board uses, and the ids are made up.

export const COMPARE_RECIPE_ID = "00000000-0000-4000-8000-0000000000e1";

const line = (
  foodName: string,
  foodId: string,
  beforeGrams: number | null,
  grams: number,
  change: AdjustmentDraft["ingredients"][number]["change"],
): AdjustmentDraft["ingredients"][number] => ({
  name: foodName,
  foodId,
  foodName,
  foodSource: "cofid",
  grams,
  beforeGrams,
  kcal: null,
  change,
});

const chickenLine = line(
  "Chicken, breast, grilled without skin, meat only",
  CHICKEN_ID,
  260,
  455,
  "changed",
);
const riceLine = line(
  "Rice, white, long grain, boiled in unsalted water",
  RICE_ID,
  360,
  180,
  "changed",
);
const oilLine = line("Oil, olive", OIL_ID, 15, 10, "changed");
const broccoliLine = line(
  "Broccoli, green, boiled in unsalted water",
  BROCCOLI_ID,
  160,
  160,
  "same",
);

/** `assistant-card · recipe-compare`: 49 g to 78 g of protein at 518 to 522 kcal. */
export const compareDraft: AdjustmentDraft = {
  variant: "adjustment",
  recipeId: COMPARE_RECIPE_ID,
  name: "Eval chicken and rice",
  servings: 2,
  ingredients: [chickenLine, riceLine, oilLine, broccoliLine],
  dropped: [],
  before: { kcal: 518.2, protein_g: 49.3, carbs_g: 58.4, fat_g: 11.2 },
  perServing: { kcal: 522.4, protein_g: 78.4, carbs_g: 30.1, fat_g: 11.3 },
  fit: { status: "within", target: { kcal: 518.2, protein_g: 79.3 }, misses: [] },
  steps: ["Cook the rice.", "Grill the chicken.", "Steam the broccoli."],
};

/** The same adjustment with a food added to it, which the board does not draw. */
export const compareWithAddedDraft: AdjustmentDraft = {
  ...compareDraft,
  ingredients: [
    ...compareDraft.ingredients,
    line("Yogurt, Greek style, plain", YOGURT_ID, null, 120, "added"),
  ],
};
