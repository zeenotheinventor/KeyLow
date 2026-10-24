import type { CheckinSummaryView } from "../types";

export type CheckinSummaryProps = {
  view: CheckinSummaryView;
  /** True on the first open after this check-in. It is read when the card is mounted. */
  isArriving: boolean;
};
