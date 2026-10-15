import * as copy from "../../../src/copy";

// Every function `src/copy/foodLog.ts` exports, called with representative arguments. The voice test fails when
// a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeFoodsAtHour: () => ["00:00", "08:00", "23:00"].map(copy.describeFoodsAtHour),
};
