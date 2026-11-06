import type { EstimateLines } from "@keylow/core/copy";
import type { StartingPlan } from "@keylow/core/setup";

export type EstimateCardProps = {
  /** The plan's targets. Every figure on the card is read from them. */
  targets: StartingPlan["targets"];
  /** The words under the numeral: the rate line, or the guardrail lines that replace it. */
  lines: EstimateLines;
};
