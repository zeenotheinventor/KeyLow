import * as copy from "../../../src/copy";

// Every function `src/copy/foodsToAvoid.ts` exports, called with representative arguments. The voice test
// fails when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeAvoidedFoodName: () => [
    copy.describeAvoidedFoodName("peanuts"),
    copy.describeAvoidedFoodName("blue cheese"),
  ],
  describeAvoidedKindConflict: () => [
    copy.describeAvoidedKindConflict("mushrooms", "dislike"),
    copy.describeAvoidedKindConflict("peanuts", "allergy"),
  ],
  describeRemoveAvoidedFood: () => [copy.describeRemoveAvoidedFood("Peanuts")],
};
