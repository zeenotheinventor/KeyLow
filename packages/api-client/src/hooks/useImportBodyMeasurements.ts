import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useSupabase } from "../KeyLowProvider";
import { keys } from "../queryKeys";
import { importBodyMeasurements } from "../repos/bodyMeasurements";

import type { BodyMeasurementInsert } from "@keylow/core/weight";

/**
 * Imports Health body fat and lean mass readings (the rows `mapHealthBodyFatSamples` and
 * `mapHealthLeanMassSamples` in core give, in either kind or mixed) for the signed in user. Rows already
 * stored are skipped, deleted ones too, so it is safe to run again. Resolves to how many rows were new
 * and how many were skipped. The measurements are refreshed once the request settles, even on a
 * failure, because an earlier chunk may have been stored.
 */
export function useImportBodyMeasurements() {
  const client = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rows: readonly BodyMeasurementInsert[]) => {
      const { data, error } = await client.auth.getUser();
      if (error) {
        throw new Error("You must be signed in to import body measurements", { cause: error });
      }

      return importBodyMeasurements(client, data.user.id, rows);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: keys.bodyMeasurements.all });
    },
  });
}
