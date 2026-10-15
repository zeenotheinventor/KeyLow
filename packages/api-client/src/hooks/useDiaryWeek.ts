import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { retryUnlessRangeError } from "./retryUnlessRangeError";
import { getDiaryWeek } from "../repos/diary";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads the week that starts on the Monday `weekStart` (`YYYY-MM-DD`): seven days, Monday to
 * Sunday, each with its totals and its day log, or null when it has none. A day with no day log is
 * not complete. Key `keys.diary.week(weekStart)`.
 */
export function useDiaryWeek(weekStart: string, { enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.diary.week(weekStart),
    queryFn: () => getDiaryWeek(client, weekStart),
    enabled,
    retry: retryUnlessRangeError,
  });
}
