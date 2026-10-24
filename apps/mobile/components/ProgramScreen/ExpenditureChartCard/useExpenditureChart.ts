import { useExpenditureHistory, useProfileTimeZone } from "@keylow/api-client";
import { toLocalDate } from "@keylow/core/dates";
import { expenditureChartWeeks } from "@keylow/core/program";

import { buildExpenditureChartView } from "./buildExpenditureChartView";
import { useNow } from "../../../lib/useNow";
import { useReadsEnabled } from "../../../lib/useReadsEnabled";

import type { ExpenditureChartState } from "./types";

/** How far back the chart reads, in whole weeks: the most it draws. */
const HISTORY_WEEKS = 12;

/**
 * What the expenditure chart card draws, from the expenditure history of the last 12 weeks. The read is not
 * limited to the active programme, so a returning user sees the ended programme's weeks and the gap before the
 * new one. Nothing is read while the terms are not accepted. If the zone cannot be read the day is UTC, as the
 * other screens read it. Nothing here is logged: the figures are health data.
 */
export function useExpenditureChart(): ExpenditureChartState {
  const enabled = useReadsEnabled();
  const history = useExpenditureHistory({ weeks: HISTORY_WEEKS, enabled });
  const timeZone = useProfileTimeZone({ enabled });
  const now = useNow();

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
