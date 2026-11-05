import { useRestoreRoutine as useRestoreRoutineWrite } from "@keylow/api-client";

import { useRoutineNotices } from "../useRoutineNotices";

/** Brings an archived routine back into the list, from the api-client, with the web's failure toast. */
export function useRestoreRoutine(): (routineId: string) => Promise<boolean> {
  const { showFailure } = useRoutineNotices();

  return useRestoreRoutineWrite({ showFailure });
}
