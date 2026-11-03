import * as copy from "../../../src/copy";

// Every function `src/copy/favouritesStrip.ts` exports, called with representative arguments. The voice test
// fails when a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeLogFavouriteName: () => [copy.describeLogFavouriteName("Porridge")],
};
