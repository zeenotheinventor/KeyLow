import { useExpenditureHistory, useTargetsHistory } from "@keylow/api-client";

import { buildCheckinSummaryView } from "./buildCheckinSummaryView";
import { selectCheckinTargetsRows } from "./selectCheckinTargetsRows";
import { useReadsEnabled } from "../../../lib/useReadsEnabled";

import type { CheckinSummaryCardProps, CheckinSummaryView } from "./types";

/**
 * How far back the card looks, in whole weeks. A user who starts a new programme within 28 days of the last
 * check-in keeps its estimate, and the first check-in comes at most three weeks after the start, so the estimate
 * the check-in moved from is at most seven weeks before it. Twelve weeks is well past that and a missed check-in.
 */
const HISTORY_WEEKS = 12;

/**
 * What the check-in summary card says, from the newest check-in, the targets history and the expenditure
 * history. The targets history holds the rows the card needs even after an edit has made the current row a
 * recompute row, and keeps the row an edit on the same day replaced. The estimate the check-in moved from is the
 * newest snapshot before it from any programme, because a returning user's new programme has no start snapshot
 * and the check-in's prior is the ended programme's. Null until both have been read, when either cannot be read,
 * and when they hold nothing of this check-in to describe, so the card is left out and the rest of the screen
 * stands. Nothing is read while the terms are not accepted. Nothing here is logged: the figures are health data.
 */
export function useCheckinSummary({
  snapshot,
  programStartedOn,
  unit,
}: Omit<CheckinSummaryCardProps, "isArriving">): CheckinSummaryView | null {
  const enabled = useReadsEnabled();
  const targetsHistory = useTargetsHistory({
    weeks: HISTORY_WEEKS,
    enabled,
    keepZeroDayRows: true,
  });
  const expenditureHistory = useExpenditureHistory({ weeks: HISTORY_WEEKS, enabled });

  if (targetsHistory.data === undefined || expenditureHistory.data === undefined) {
    return null;
  }
  const rows = selectCheckinTargetsRows(targetsHistory.data, snapshot.asOfDate, programStartedOn);
  const previousSnapshot =
    expenditureHistory.data.filter((candidate) => candidate.asOfDate < snapshot.asOfDate).at(-1) ??
    null;

  return rows === null
    ? null
    : buildCheckinSummaryView({ snapshot, previousSnapshot, unit, ...rows });
}
