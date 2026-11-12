import type { CheckinSummaryView } from "@keylow/core/program";

export type CheckinSummaryProps = {
  view: CheckinSummaryView;
  /** Set on the first open after a new check-in: the card cuts in from the side, or only fades with reduced motion. */
  isArriving: boolean;
};
