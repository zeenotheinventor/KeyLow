import { summariseRoutine } from "@keylow/core/training";
import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { listRoutines } from "../repos/routines";

import type { RoutineListEntry } from "../repos/routineSchemas";

export type UseRoutinesOptions = {
  /** False lists the live routines, and true adds the archived ones to them. */
  archived: boolean;
  enabled?: boolean;
};

const withSummary = (routines: RoutineListEntry[]) =>
  routines.map((routine) => ({ ...routine, summary: summariseRoutine(routine) }));

/**
 * Loads the signed in user's routines by name, each with its flags, when it was last activated, its
 * days and what a routine card shows: `summary` (days, each day's weekday, exercises and sets, and the
 * sets in a week). Key `keys.training.routines(archived)`. The query holds the rows only and is kept
 * in the mobile cache, so the routines open without a connection: the summary is worked out in
 * `select` and never stored. `archived` true includes the archived routines, which the caller tells
 * apart by `is_archived`. `enabled` false makes no request at all.
 */
export function useRoutines({ archived, enabled = true }: UseRoutinesOptions) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.training.routines(archived),
    queryFn: () => listRoutines(client, { archived }),
    select: withSummary,
    enabled,
  });
}
