import * as copy from "../../../src/copy";
import { edgeErrorCodeSchema } from "../../../src/schemas";

// Every function `src/copy/errors.ts` exports, called with representative arguments. The voice test fails when
// a function has no row, so no sentence escapes the sweep.
export const samples: Record<string, () => string[]> = {
  describeRateLimit: () => [undefined, 1, 30].map(copy.describeRateLimit),
  describeEdgeError: () => [undefined, ...edgeErrorCodeSchema.options].map(copy.describeEdgeError),
};
