"use client";

import { useExpenditureHistory, useWeightTrend } from "@keylow/api-client";
import { ESTIMATE_HISTORY_WEEKS, isWaitingForProgramme } from "@keylow/core/setup";

import type { SetupMode } from "@/lib/setupRoutes";

/**
 * What a recalculation after a check-in keeps the measured expenditure from. The wizard starts these reads when it
 * opens, so they are there when the estimate is, and a first run reads none of it: a new account has no programme.
 * `isWaiting` holds Start while either is still loading, because the figures on the estimate are then not the ones
 * the save will make. A history that failed is not waited for, and the estimate of the answers is drawn as it is.
 */
export function useProgrammeReads(mode: SetupMode) {
  const isRecalculating = mode === "recalculate";
  const expenditureHistory = useExpenditureHistory({
    weeks: ESTIMATE_HISTORY_WEEKS,
    enabled: isRecalculating,
  });
  const weightTrend = useWeightTrend({ enabled: isRecalculating });

  return {
    expenditureHistory,
    weightTrend,
    isWaiting: isWaitingForProgramme({
      isRecalculating,
      isHistoryPending: expenditureHistory.isPending,
      isTrendLoading: weightTrend.isLoading,
    }),
  };
}

export type ProgrammeReads = ReturnType<typeof useProgrammeReads>;
