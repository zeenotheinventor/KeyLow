import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { retryUnlessRangeError } from "./retryUnlessRangeError";
import { listCompleteDays } from "../repos/diary";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads the dates in a calendar month (`YYYY-MM`) that are marked complete, in date order, for the
 * dots on the date pickers. Key `keys.diary.completeDays(month)`.
 */
export function useCompleteDays(month: string, { enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.diary.completeDays(month),
    queryFn: () => listCompleteDays(client, month),
    enabled,
    retry: retryUnlessRangeError,
  });
}
