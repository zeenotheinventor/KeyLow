import * as copy from "../../../src/copy";

// Every function `src/copy/scaledAmount.ts` exports, called with representative arguments. The voice test fails
// when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeScaledAmount: () => [
    copy.describeScaledAmount({ unit: "g", quantity: 750, resolvedGrams: 750, portion: null }),
    copy.describeScaledAmount({ unit: "g", quantity: 50000, resolvedGrams: 50000, portion: null }),
    copy.describeScaledAmount({ unit: "fl_oz", quantity: 6.5, resolvedGrams: 192, portion: null }),
    copy.describeScaledAmount({
      unit: "portion",
      quantity: 1.5,
      resolvedGrams: 75,
      portion: { label: "1 large" },
    }),
    copy.describeScaledAmount({
      unit: "portion",
      quantity: 0.25,
      resolvedGrams: 3.75,
      portion: { label: "1 tbsp", ml: 15 },
    }),
  ],
};
