import { useCheckinSummary } from "@keylow/api-client";

import { CheckinSummary } from "./CheckinSummary";

import type { CheckinSummaryCardProps } from "./types";

/**
 * What the last check-in changed and why, under this week's targets (`program-default`). It reads the targets
 * history to find the check-in's own targets row, and draws nothing until it has something true to say, so the
 * rest of the page stands without it. A new check-in shows at rest: its first open motion is KEY-871's.
 */
export function CheckinSummaryCard(props: CheckinSummaryCardProps) {
  const view = useCheckinSummary({ ...props, enabled: true });

  return view === null ? null : <CheckinSummary view={view} />;
}
