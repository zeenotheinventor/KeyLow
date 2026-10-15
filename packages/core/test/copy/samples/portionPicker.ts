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
  describePortionNoun: () => [
    copy.describePortionNoun("1 medium (100 g)") ?? "",
    copy.describePortionNoun("30 g") ?? "none",
  ],
  describePortionUnit: () => [
    copy.describePortionUnit("1 bar", 1),
    copy.describePortionUnit("30 g", 2),
  ],
  describePortionWithSize: () => [
    copy.describePortionWithSize("1 medium", { amount: 100, unit: "g" }),
    copy.describePortionWithSize("30 g", { amount: 30, unit: "g" }),
  ],
  describeLastLogged: () => [
    copy.describeLastLogged("50 g", 0, "Thu 15 Oct"),
    copy.describeLastLogged("50 g", 1, "Wed 14 Oct"),
    copy.describeLastLogged("50 g", 5, "Sat 10 Oct"),
  ],
};
