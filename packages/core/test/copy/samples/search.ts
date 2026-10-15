import * as copy from "../../../src/copy";

// Every function `src/copy/search.ts` exports, called with representative arguments. The voice test fails when
// a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeSeeMore: () => [1, 2, 18].map(copy.describeSeeMore),
};
