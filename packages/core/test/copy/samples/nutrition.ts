import * as copy from "../../../src/copy";

// Every function `src/copy/nutrition.ts` exports, called with representative arguments. The voice test fails when
// a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeBasis: () => (["per_100g", "per_100ml"] as const).map(copy.describeBasis),
  describeSpokenBasis: () => (["per_100g", "per_100ml"] as const).map(copy.describeSpokenBasis),
  describeEnergy: () => [0, 1, 148, 2480, null].map(copy.describeEnergy),
  describeShareOfEnergy: () => [0, 32, 100].map(copy.describeShareOfEnergy),
};
