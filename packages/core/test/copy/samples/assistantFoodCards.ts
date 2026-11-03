import * as copy from "../../../src/copy";

// Every function `src/copy/assistantFoodCards.ts` exports, called with representative arguments. The voice
// test fails when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeFoodCreatedTitle: () => [copy.describeFoodCreatedTitle("Protein bar")],
  describeFoodCreatedSub: () => [
    copy.describeFoodCreatedSub("1 bar"),
    copy.describeFoodCreatedSub(null),
  ],
  describeFoodCreatedRowName: () => [
    copy.describeFoodCreatedRowName("1 bar"),
    copy.describeFoodCreatedRowName("2 slices"),
    copy.describeFoodCreatedRowName(null),
  ],
  describeFoodCreatedUndone: () => [copy.describeFoodCreatedUndone("Protein bar")],
  describeFoodsCount: () => [copy.describeFoodsCount(1), copy.describeFoodsCount(3)],
};
