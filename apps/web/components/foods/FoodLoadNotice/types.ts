import type { FoodWithPortionsState } from "../useFoodWithPortions";

export type FoodLoadNoticeProps = {
  /** Any state of a food that is not yet ready to show. */
  state: Exclude<FoodWithPortionsState, { kind: "ready" }>;
};
