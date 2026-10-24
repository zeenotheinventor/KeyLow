import { CheckinSummary } from "./CheckinSummary";
import { useCheckinSummary } from "./useCheckinSummary";

import type { CheckinSummaryCardProps } from "./types";

/**
 * What the last check-in changed and why, under this week's targets (`program: default`). It reads the targets
 * history to find the check-in's own targets row, and draws nothing until it has something true to say, so the
 * rest of the screen stands without it. On the first open after a new check-in it cuts in.
 */
export function CheckinSummaryCard({ isArriving, ...input }: CheckinSummaryCardProps) {
  const view = useCheckinSummary(input);

  return view === null ? null : <CheckinSummary isArriving={isArriving} view={view} />;
}
