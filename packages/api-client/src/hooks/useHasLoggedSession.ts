import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { hasLoggedSession } from "../repos/training";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Whether the signed in user has ever logged a session. The Train home tells its first visit from a
 * user with sessions and no routine by it. Key `keys.training.hasLoggedSession`. The query holds a yes
 * or no and is kept in the mobile cache.
 */
export function useHasLoggedSession({ enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.training.hasLoggedSession,
    queryFn: () => hasLoggedSession(client),
    enabled,
  });
}
