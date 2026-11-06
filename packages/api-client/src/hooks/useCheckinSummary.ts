import { buildCheckinSummaryView, selectCheckinTargetsRows } from "@keylow/core/program";

import { useExpenditureHistory } from "./useExpenditureHistory";
import { useTargetsHistory } from "./useTargetsHistory";

import type { ExpenditureSnapshot } from "../repos/program";
import type { CheckinSummaryView } from "@keylow/core/program";
import type { WeightDisplayUnit } from "@keylow/core/weight";

/**
 * How far back the card looks, in whole weeks. A user who starts a new programme within 28 days of the last
 * check-in keeps its estimate, and the first check-in comes at most three weeks after the start, so the estimate
 * the check-in moved from is at most seven weeks before it. Twelve weeks is well past that and a missed check-in.
 */
const HISTORY_WEEKS = 12;

/** What `useCheckinSummary` takes. */
export type UseCheckinSummaryOptions = {
  /** The programme's newest snapshot, which is a check-in. */
  snapshot: Extract<ExpenditureSnapshot, { kind: "checkin" }>;
  /** The day the active programme began, `YYYY-MM-DD`: targets rows from before it are another programme's. */
  programStartedOn: string;
  unit: WeightDisplayUnit;
  /** False makes no request at all, as the diary reads do. */
  enabled: boolean;
};

/**
 * What the check-in summary card says, from the newest check-in, the targets history and the expenditure
 * history. The targets history holds the rows the card needs even after an edit has made the current row a
 * recompute row, and keeps the row an edit on the same day replaced. The estimate the check-in moved from is the
 * newest snapshot before it from any programme, because a returning user's new programme has no start snapshot
 * and the check-in's prior is the ended programme's. Null until both have been read, when either cannot be read,
 * and when they hold nothing of this check-in to describe, so the card is left out and the rest of the screen
 * stands. Nothing is read while `enabled` is false. Nothing here is logged: the figures are health data.
 */
export function useCheckinSummary({
  snapshot,
  programStartedOn,
  unit,
  enabled,
}: UseCheckinSummaryOptions): CheckinSummaryView | null {
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
