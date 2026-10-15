import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getDiaryDay } from "../repos/diary";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads one day of the diary, `localDate` as `YYYY-MM-DD`: the live entries as a flat list in time
 * order (group it with `groupEntriesByHour` from core), the day's log row and its totals. Key
 * `keys.diary.day(localDate)`.
 */
export function useDiaryDay(localDate: string, { enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.diary.day(localDate),
    queryFn: () => getDiaryDay(client, localDate),
    enabled,
  });
}
