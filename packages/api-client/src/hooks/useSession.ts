import { skipToken, useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getSession } from "../repos/trainingSessions";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads one live session of the signed in user with its routine day's name and its live sets in the
 * order they are listed, or null when it does not exist, is deleted or is not theirs. Key
 * `keys.training.session(id)`. The query holds rows only and is kept in the mobile cache, so a session
 * in progress opens without a connection.
 *
 * Nothing is asked while `id` is undefined. `enabled` false makes no request at all.
 */
export function useSession(id: string | undefined, { enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.training.session(id ?? ""),
    queryFn: id === undefined ? skipToken : () => getSession(client, id),
    enabled,
  });
}
