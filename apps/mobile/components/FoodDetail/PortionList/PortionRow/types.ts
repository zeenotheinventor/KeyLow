import type { FoodPortion } from "@keylow/core/schemas";

export type PortionRowProps = {
  portion: FoodPortion;
  /** The first row has no hairline above it. */
  isFirst: boolean;
};
