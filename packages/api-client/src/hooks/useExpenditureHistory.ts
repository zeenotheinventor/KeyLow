import { useProgramHistory } from "./useProgramHistory";
import { keys } from "../queryKeys";
import { listMyExpenditureSnapshots } from "../repos/program";

import type { ProgramHistoryOptions } from "./ProgramHistoryOptions";
import type { TrainingReadResult } from "./trainingReadResult";
import type { ExpenditureSnapshot } from "../repos/program";

/**
 * Loads the signed in user's expenditure snapshots of the last `weeks` weeks, oldest first, for the
 * expenditure chart. The range starts `weeks` whole weeks before today in the profile's time zone (UTC
 * for a profile with none). It is health data. Key `keys.program.expenditureHistory(weeks)`, which the
 * mobile offline cache does not keep. The result is pending until the time zone and the snapshots are
 * there, and is an error when either cannot be read (`refetch` tries again). `weeks` must be a positive
 * whole number, or the result is a `RangeError` with no request made. `enabled` false makes no request
 * at all. A failure of the snapshots names the action and the code only.
 */
export function useExpenditureHistory(
  options: ProgramHistoryOptions,
): TrainingReadResult<ExpenditureSnapshot[]> {
  return useProgramHistory(
    keys.program.expenditureHistory(options.weeks),
    options,
    (client, fromDate) => listMyExpenditureSnapshots(client, { fromDate }),
  );
}
