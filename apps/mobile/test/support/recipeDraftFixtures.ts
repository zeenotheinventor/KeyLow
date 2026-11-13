import type { SuggestionDraft } from "@keylow/core";

// The drafts of the boards `assistant-card · recipe-draft`, `-short` and `-unmatched`, with their figures. The
// foods are the CoFID ones the boards use, and the ids are made up.

export const CHICKEN_ID = "00000000-0000-4000-8000-0000000000f1";
export const RICE_ID = "00000000-0000-4000-8000-0000000000f2";
export const BROCCOLI_ID = "00000000-0000-4000-8000-0000000000f3";
export const YOGURT_ID = "00000000-0000-4000-8000-0000000000f4";
export const OIL_ID = "00000000-0000-4000-8000-0000000000f5";
export const SALMON_ID = "00000000-0000-4000-8000-0000000000f6";

const line = (
  name: string,
  foodId: string,
  foodName: string,
  grams: number,
  kcal: number,
): SuggestionDraft["ingredients"][number] => ({
  name,
  foodId,
  foodName,
  foodSource: "cofid",
  grams,
  beforeGrams: null,
  kcal,
  change: "same",
});

const chickenLine = line(
  "chicken breast",
  CHICKEN_ID,
  "Chicken, breast, grilled without skin, meat only",
  220,
  325.6,
);
const riceLine = line(
  "cooked white rice",
  RICE_ID,
  "Rice, white, long grain, boiled in unsalted water",
  390,
  510.9,
);
const broccoliLine = line(
  "broccoli",
  BROCCOLI_ID,
  "Broccoli, green, boiled in unsalted water",
  100,
  28,
);
const oilLine = line("olive oil", OIL_ID, "Oil, olive", 20, 179.8);

/** `assistant-card · recipe-draft`: 599 kcal and 46 g protein for a 600 kcal and 45 g ask. */
export const fittingDraft: SuggestionDraft = {
  variant: "suggestion",
  name: "Chicken and rice with yogurt sauce",
  servings: 2,
  ingredients: [
    chickenLine,
    riceLine,
    broccoliLine,
    line("Greek yogurt", YOGURT_ID, "Yogurt, Greek style, plain", 115, 152.9),
    oilLine,
  ],
  dropped: [],
  perServing: { kcal: 599, protein_g: 46.4, carbs_g: 65.1, fat_g: 19.2 },
  fit: { status: "within", target: { kcal: 600, protein_g: 45 }, misses: [] },
  steps: [
    "Cook the rice.",
    "Grill the chicken.",
    "Stir the yogurt into the rice.",
    "Serve with the broccoli.",
  ],
};

/** `assistant-card · recipe-draft-short`: salmon cannot reach 60 g of protein inside the calories. */
export const shortDraft: SuggestionDraft = {
  variant: "suggestion",
  name: "Salmon, potatoes and broccoli",
  servings: 2,
  ingredients: [
    line("salmon fillet", SALMON_ID, "Salmon, farmed, flesh only, grilled", 360, 860.4),
    line(
      "boiled potatoes",
      RICE_ID,
      "Potatoes, old, boiled in unsalted water, flesh only",
      250,
      185,
    ),
    line("broccoli", BROCCOLI_ID, "Broccoli, green, boiled in unsalted water", 400, 112),
    line("olive oil", OIL_ID, "Oil, olive", 10, 89.9),
  ],
  dropped: [],
  perServing: { kcal: 624, protein_g: 53, carbs_g: 27.4, fat_g: 34.1 },
  fit: {
    status: "unreachable",
    target: { kcal: 600, protein_g: 60 },
    misses: [
      {
        nutrient: "protein_g",
        target: 60,
        achieved: 53,
        reason: "ingredient_bounds",
        limitedBy: ["salmon fillet"],
      },
    ],
  },
  steps: ["Roast the potatoes.", "Grill the salmon.", "Steam the broccoli.", "Serve together."],
};

/** `assistant-card · recipe-draft-unmatched`: one line matched no food, and is not in the numbers. */
export const unmatchedDraft: SuggestionDraft = {
  variant: "suggestion",
  name: "Spicy chicken traybake",
  servings: 2,
  ingredients: [
    chickenLine,
    oilLine,
    {
      name: "harissa paste",
      foodId: null,
      foodName: null,
      foodSource: null,
      grams: 30,
      beforeGrams: null,
      kcal: null,
      change: "same",
    },
  ],
  dropped: [],
  perServing: { kcal: 499, protein_g: 51.1, carbs_g: 52.3, fat_g: 11.2 },
  fit: { status: "within", target: { kcal: 500, protein_g: 50 }, misses: [] },
  steps: ["Heat the oven.", "Toss everything.", "Roast.", "Rest.", "Serve."],
};
