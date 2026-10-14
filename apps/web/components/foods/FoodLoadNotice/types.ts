import type { FoodWithPortionsState } from "@keylow/api-client";

export type FoodLoadNoticeProps = {
  /** Any state of a food that is not yet ready to show. */
  state: Exclude<FoodWithPortionsState, { status: "ready" }>;
};
