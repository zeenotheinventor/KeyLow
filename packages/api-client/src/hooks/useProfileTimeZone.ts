import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getMyTimeZone } from "../repos/targets";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads the IANA time zone of the signed in user's profile, which the diary reads its days and hours
 * in, or null when there is no profile row. Key `keys.profiles.timeZone`.
 */
export function useProfileTimeZone({ enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.profiles.timeZone,
    queryFn: () => getMyTimeZone(client),
    enabled,
  });
}
