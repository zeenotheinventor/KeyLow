import { useRoutineProgress as useRoutineProgressRead } from "@keylow/api-client";

import { useNow } from "../../lib/useNow";
import { useReadsEnabled } from "../../lib/useReadsEnabled";

import type { RoutineProgressState } from "../RoutineProgressDay";

/**
 * The progress of every exercise of a routine, by routine day, for the Progress section of the routines
 * screen. The reads and the trend are api-client's `useRoutineProgress`, shared with the web. The phone gives
 * it the reads gate and its clock, and keeps all the reads, so it opens without a connection.
 */
export function useRoutineProgress(routineId: string | undefined): RoutineProgressState {
  return useRoutineProgressRead(routineId, { enabled: useReadsEnabled(), now: useNow() }).state;
}
