import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { listOwnFoods } from "../repos/foods";

/**
 * Loads the signed in user's own foods by name, up to 200, with no query needed. Creating or
 * updating a food refreshes it, since both invalidate every foods query. The screen slices the
 * list for "See N more".
 */
export function useOwnFoods() {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.foods.own,
    queryFn: () => listOwnFoods(client),
  });
}
