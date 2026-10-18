import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getActiveSession } from "../repos/trainingSessions";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads the signed in user's newest live session that has not ended, with its routine day's name and its
 * sets, or null when there is none. The session bar and the Resume button read it. Key
 * `keys.training.activeSession`. The query holds rows only and is kept in the mobile cache.
 */
export function useActiveSession({ enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.training.activeSession,
    queryFn: () => getActiveSession(client),
    enabled,
  });
}
