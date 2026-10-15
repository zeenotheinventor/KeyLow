import * as copy from "../../../src/copy";

// Every function `src/copy/foodSources.ts` exports, called with representative arguments. The voice test fails when
// a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeFoodSource: () => (["off", "cofid", "user"] as const).map(copy.describeFoodSource),
};
