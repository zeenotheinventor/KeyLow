import { toLocalDate } from "@keylow/core/dates";
import { buildExpenditureChartView, expenditureChartWeeks } from "@keylow/core/program";

import { useExpenditureHistory } from "./useExpenditureHistory";
import { useProfileTimeZone } from "./useProfileTimeZone";

import type { ExpenditureChartView } from "@keylow/core/program";

/** How far back the chart reads, in whole weeks: the most it draws. */
const HISTORY_WEEKS = 12;

/** The chart card's four states. It draws nothing while the history is being read. */
export type ExpenditureChartState =
  | { status: "pending" }
  | { status: "error"; retry: () => void }
  | { status: "empty" }
  | { status: "chart"; view: ExpenditureChartView };

/** What `useExpenditureChart` takes. */
export type UseExpenditureChartOptions = {
  /** False makes no request at all, as the diary reads do. */
  enabled: boolean;
  /** The current time, which gives today in the profile's zone. The caller owns the clock, so it can tick. */
  now: Date;
};

/**
 * What the expenditure chart card draws, from the expenditure history of the last 12 weeks. The read is not
 * limited to the active programme, so a returning user sees the ended programme's weeks and the gap before the
 * new one. Nothing is read while `enabled` is false. If the zone cannot be read the day is UTC, as the
 * other screens read it. Nothing here is logged: the figures are health data.
 */
export function useExpenditureChart({
  enabled,
  now,
}: UseExpenditureChartOptions): ExpenditureChartState {
  const history = useExpenditureHistory({ weeks: HISTORY_WEEKS, enabled });
  const timeZone = useProfileTimeZone({ enabled });

  if (history.isError) {
    return {
      status: "error",
      retry: () => {
        void history.refetch();
      },
    };
  }
  if (history.data === undefined) {
    return { status: "pending" };
  }

  const view = buildExpenditureChartView(
    expenditureChartWeeks(history.data, toLocalDate(now, timeZone.data ?? "UTC")),
  );
  return view === null ? { status: "empty" } : { status: "chart", view };
}
