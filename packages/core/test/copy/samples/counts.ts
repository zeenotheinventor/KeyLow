import * as copy from "../../../src/copy";

// Every function `src/copy/counts.ts` exports, called with representative arguments. The voice test fails
// when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeCount: () => [
    copy.describeCount(1, "session", "sessions"),
    copy.describeCount(3, "session", "sessions"),
  ],
};
