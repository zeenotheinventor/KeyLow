import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { setRoutineArchived } from "../repos/routineWrites";
import { refreshRoutines } from "../routineCache";
import { useSingleFlight } from "./useSingleFlight";

type ArchiveInput = { id: string; archived: boolean };

/**
 * Archives a routine, or brings it back with `archived: false`, and resolves to it as stored. The days
 * and exercises are untouched, and so are the sessions logged from the routine. The Undo of an archive
 * is this hook again with the same id and `archived: false`: an Undo tapped while the archive is still
 * on its way runs after it, and the last tap wins. The active routine cannot be archived: it throws a
 * `RoutineRuleError` with the rule `active_routine`, so the screen makes another routine active first.
 * Needs a connection: there is no offline queue.
 *
 * The routines queries are refreshed after, also after a failure. The plan is not touched, because an
 * archived routine is never the active one.
 */
export function useArchiveRoutine() {
  const client = useSupabase();
  const queryClient = useQueryClient();
  const archiveOnce = useSingleFlight(({ id, archived }: ArchiveInput) =>
    setRoutineArchived(client, id, archived),
  );

  return useMutation({
    mutationFn: archiveOnce,
    onSettled: () => {
      refreshRoutines(queryClient);
    },
  });
}
