import * as copy from "../../../src/copy";

// Every function `src/copy/foodRow.ts` exports, called with representative arguments. The voice test fails when
// a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeAddFood: () => [
    copy.describeAddFood("Banana", "1 medium (100 g)"),
    copy.describeAddFood("Banana"),
  ],
  describeEditFood: () => [copy.describeEditFood("Porridge oats")],
  describeDeleteFood: () => [copy.describeDeleteFood("Porridge oats")],
  describeFoodRowStats: () => [
    copy.describeFoodRowStats({ energy: "222", protein: "48", carbs: "0", fat: "3.3" }),
    copy.describeFoodRowStats({ energy: "130" }),
    copy.describeFoodRowStats({}),
  ],
};
