import type { AdjustmentDraft } from "../../src/assistant";

// The draft of the board `assistant-card · recipe-compare`: Eval chicken and rice, 30 g more protein a serving at
// the same calories. The ids are made up.
export const idOf = (number: number) =>
  `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;

const line = (
  foodName: string,
  foodNumber: number,
  beforeGrams: number | null,
  grams: number,
  change: AdjustmentDraft["ingredients"][number]["change"],
): AdjustmentDraft["ingredients"][number] => ({
  name: foodName,
  foodId: idOf(foodNumber),
  foodName,
  foodSource: null,
  grams,
  beforeGrams,
  kcal: null,
  change,
});

export const chickenLine = line(
  "Chicken, breast, grilled without skin, meat only",
  1,
  260,
  455,
  "changed",
);
export const riceLine = line(
  "Rice, white, long grain, boiled in unsalted water",
  2,
  360,
  180,
  "changed",
);
export const oilLine = line("Oil, olive", 3, 15, 10, "changed");
export const broccoliLine = line("Broccoli, green, boiled in unsalted water", 4, 160, 160, "same");
export const yogurtLine = line("Yogurt, Greek style, plain", 5, null, 120, "added");

export const compareDraft: AdjustmentDraft = {
  variant: "adjustment",
  recipeId: idOf(9),
  name: "Eval chicken and rice",
  servings: 2,
  ingredients: [chickenLine, riceLine, oilLine, broccoliLine],
  dropped: [],
  before: { kcal: 518.2, protein_g: 49.3, carbs_g: 58.4, fat_g: 11.2 },
  perServing: { kcal: 522.4, protein_g: 78.4, carbs_g: 30.1, fat_g: 11.3 },
  fit: { status: "within", target: { kcal: 518.2, protein_g: 79.3 }, misses: [] },
  steps: ["Cook the rice.", "Grill the chicken.", "Steam the broccoli."],
};
