import type { EstimateLines } from "../types";
import type { StartingPlan } from "@keylow/core/setup";

export type EstimateCardProps = {
  /** The calories and macros to show, as `startingPlan` made them. */
  targets: StartingPlan["targets"];
  lines: EstimateLines;
};
