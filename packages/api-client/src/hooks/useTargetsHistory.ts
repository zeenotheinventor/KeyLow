import { useProgramHistory } from "./useProgramHistory";
import { keys } from "../queryKeys";
import { listMyTargetsHistory } from "../repos/program";

import type { ProgramHistoryOptions } from "./ProgramHistoryOptions";
import type { TrainingReadResult } from "./trainingReadResult";
import type { TargetsRow } from "../repos/program";

/**
 * Loads the signed in user's targets rows that touch the last `weeks` weeks, oldest first: the rows that
 * ended after the range began, and the open row. The range starts `weeks` whole weeks before today in
 * the profile's time zone (UTC for a profile with none). An open row is marked current only while a
 * program is active. It is health data. Key `keys.program.targetsHistory(weeks)`, which the mobile
 * offline cache does not keep. The result is pending until the time zone and the rows are there, and is
 * an error when either cannot be read (`refetch` tries again). `weeks` must be a positive whole number,
 * or the result is a `RangeError` with no request made. `enabled` false makes no request at all. A
 * failure of the rows names the action and the code only. `keepZeroDayRows` keeps the rows that held for no
 * days (see `listMyTargetsHistory`), under the key `keys.program.targetsHistoryWithZeroDayRows(weeks)`.
 */
export function useTargetsHistory(
  options: ProgramHistoryOptions & { keepZeroDayRows?: boolean },
): TrainingReadResult<TargetsRow[]> {
  const { keepZeroDayRows = false } = options;

  return useProgramHistory(
    keepZeroDayRows
      ? keys.program.targetsHistoryWithZeroDayRows(options.weeks)
      : keys.program.targetsHistory(options.weeks),
    options,
    (client, fromDate) => listMyTargetsHistory(client, { fromDate, keepZeroDayRows }),
  );
}
