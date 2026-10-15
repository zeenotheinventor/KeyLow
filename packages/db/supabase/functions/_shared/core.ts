// Functions import @keylow/core through this file, never through ./core/index.js directly. The
// bundle behind it is written by `bundle-core-for-deno` and typed by the @ts-self-types pragma in
// it, so a missing or stale bundle fails `deno check` here. Export what a function needs.
export type { EdgeError, EdgeErrorCode, OffProductResponse } from "./core/index.js";
export {
  normaliseBarcode,
  normaliseOffCandidate,
  normaliseOffProduct,
  offFreshness,
  offProductPayloadSchema,
  offProductRequestSchema,
  offCandidateSchema,
  offProductResponseSchema,
  offSearchRequestSchema,
  offSearchResponseSchema,
  toLocalDate,
} from "./core/index.js";
