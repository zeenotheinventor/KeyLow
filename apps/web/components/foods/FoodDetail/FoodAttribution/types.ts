import type { DATA_SOURCE_ATTRIBUTION } from "@keylow/core/foods";

export type FoodAttributionProps = {
  /** The credit line and link of a source that requires one. */
  attribution: (typeof DATA_SOURCE_ATTRIBUTION)[keyof typeof DATA_SOURCE_ATTRIBUTION];
};
