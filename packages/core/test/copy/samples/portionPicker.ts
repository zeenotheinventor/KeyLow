import * as copy from "../../../src/copy";

// Every function `src/copy/portionPicker.ts` exports, called with representative arguments. The voice test
// fails when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describePer100Heading: () => [
    copy.describePer100Heading("per_100g"),
    copy.describePer100Heading("per_100ml"),
  ],
  describeScannedCode: () => [copy.describeScannedCode("5201054013410")],
  describeAmountBasis: () => [
    copy.describeAmountBasis({ unit: "g", quantity: 150 }),
    copy.describeAmountBasis({
      unit: "portion",
      quantity: 2,
      portionLabel: "1 bar",
      portionSize: { amount: 45, unit: "g" },
    }),
  ],
  describePortionCount: () => [1, 2].map(copy.describePortionCount),
};
