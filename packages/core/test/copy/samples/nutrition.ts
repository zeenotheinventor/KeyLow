import * as copy from "../../../src/copy";

// Every function `src/copy/nutrition.ts` exports, called with representative arguments. The voice test fails when
// a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeBasis: () => [
    ...(["per_100g", "per_100ml", "per_portion"] as const).map((basis) =>
      copy.describeBasis(basis),
    ),
    copy.describeBasis("per_portion", "1 bucket"),
  ],
  describeSpokenBasis: () => [
    ...(["per_100g", "per_100ml", "per_portion"] as const).map((basis) =>
      copy.describeSpokenBasis(basis),
    ),
    copy.describeSpokenBasis("per_portion", "1 bucket"),
  ],
  describeEnergy: () => [0, 1, 148, 2480, null].map(copy.describeEnergy),
  describeLiveGroupNote: () => [false, true].map(copy.describeLiveGroupNote),
  describeShareOfEnergy: () => [0, 32, 100].map(copy.describeShareOfEnergy),
};
