import * as copy from "../../../src/copy";

// Every function `src/copy/legal.ts` exports, called with representative arguments. The voice test fails when
// a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeLastUpdated: () => ["2026-10-15", "2027-01-03"].map(copy.describeLastUpdated),
};
