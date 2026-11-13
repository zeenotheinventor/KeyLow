import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { listPalateFoods } from "../repos/palatePreferences";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads the name, source and food group of the foods the palate's stats are about, which core reads to
 * name and group them. Nothing is asked for an empty list of ids. The same ids in another order are the same request, and while new ids load the foods of the last ones stay. They come from the diary, so they are
 * health data: an error names the action and the code only. Key `keys.palate.foods(ids)`, which no
 * device keeps.
 *
 * `enabled` is the same option the diary reads take: false makes no request at all.
 */
export function usePalateFoods(
  foodIds: readonly string[],
  { enabled = true }: DiaryReadOptions = {},
) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.palate.foods(foodIds),
    queryFn: () => listPalateFoods(client, foodIds),
    enabled: enabled && foodIds.length > 0,
    // The ids change as the diary does, and the screen keeps what it drew until the new foods arrive.
    placeholderData: keepPreviousData,
  });
}
