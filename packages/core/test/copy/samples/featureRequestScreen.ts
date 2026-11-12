import * as copy from "../../../src/copy";

// Every function `src/copy/featureRequestScreen.ts` exports, called with representative arguments.

export const samples: Record<string, () => string[]> = {
  describeFeatureRequestLength: () => [copy.describeFeatureRequestLength("Water tracking")],
};
