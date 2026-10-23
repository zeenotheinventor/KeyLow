import { useQuery } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { listBodyMeasurements } from "../repos/bodyMeasurements";

import type { DiaryReadOptions } from "./DiaryReadOptions";
import type { BodyMeasurementKind } from "@keylow/core/weight";

/**
 * Loads every live measurement of one kind (`body_fat_pct` or `lean_mass_kg`) for the signed in user,
 * newest first (`local_date`, `measured_at`, `id`, all descending), however many there are: the repo
 * reads it a page of 1,000 at a time. Key `keys.bodyMeasurements.list(kind)`. Body measurements are
 * health data, and this key is not in the persisted offline cache.
 */
export function useBodyMeasurements(
  kind: BodyMeasurementKind,
  { enabled = true }: DiaryReadOptions = {},
) {
  const client = useSupabase();

  return useQuery({
    queryKey: keys.bodyMeasurements.list(kind),
    queryFn: () => listBodyMeasurements(client, kind),
    enabled,
  });
}
