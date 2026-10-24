import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getMyProgramSummary } from "../repos/program";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads what the program screen shows: the active program with its next check-in date, the newest two
 * expenditure snapshots and the current and previous targets. It is health data. Key
 * `keys.program.summary`, which the mobile offline cache does not keep: the program screen may show its
 * loading state without a connection. With no active program the summary is all null. `enabled` false
 * makes no request. A failure names the action and the code only.
 */
export function useProgramSummary({ enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.program.summary,
    queryFn: () => getMyProgramSummary(client),
    enabled,
  });
}
