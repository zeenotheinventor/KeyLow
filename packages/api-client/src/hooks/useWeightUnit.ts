import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { getMyWeightUnit } from "../repos/targets";

import type { DiaryReadOptions } from "./DiaryReadOptions";

/**
 * Loads the unit the signed in user's profile shows loads in, `kg` or `lb`. A profile with no unit, with
 * stone (which training does not use) or with a unit this build does not know reads as `kg`. Loads are
 * stored in kg whatever the unit. Key `keys.profiles.weightUnit`.
 */
export function useWeightUnit({ enabled = true }: DiaryReadOptions = {}) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.profiles.weightUnit,
    queryFn: () => getMyWeightUnit(client),
    enabled,
  });
}
