import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { listRecentFoods } from "../repos/diary";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads the foods the user logged most recently, each once, newest first, with the snapshot of the
 * entry that logged it last. Key `keys.diary.recentFoods`.
 */
export function useRecentFoods({ enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.diary.recentFoods,
    queryFn: () => listRecentFoods(client),
    enabled,
  });
}
