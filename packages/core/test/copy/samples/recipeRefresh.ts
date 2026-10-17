import * as copy from "../../../src/copy";

// Every function `src/copy/recipeRefresh.ts` exports, called with representative arguments. The voice test fails
// when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeBeforeAfter: () => [
    copy.describeBeforeAfter(copy.REFRESH.calories, { before: 374.2, after: 361.7 }, "energy"),
    copy.describeBeforeAfter("Carbs", { before: 42.55, after: 42.55 }, "grams"),
    copy.describeBeforeAfter("Fibre", { before: 2, after: null }, "grams"),
  ],
  describePortionFellBack: () => [
    copy.describePortionFellBack({
      before: { quantity: 1, unit: "portion", portionLabel: "1 medium" },
      after: { quantity: 110, unit: "g", portionLabel: null },
    }),
  ],
};
