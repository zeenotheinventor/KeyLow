import type { PortionStore } from "./importPortions";
import type { Database } from "../../src/types.gen";
import type { SupabaseClient } from "@supabase/supabase-js";

type Failure = { message: string } | null;

// The message names the action, never a row: a row holds a food and a portion size.
function raiseOnFailure(error: Failure, action: string): void {
  if (error) {
    throw new Error(`Could not ${action}: ${error.message}`, { cause: error });
  }
}

/** Reads and writes through PostgREST with a service role client, which is the only role allowed to write global portions. */
export function createSupabasePortionStore(client: SupabaseClient<Database>): PortionStore {
  return {
    async findFoodIds(foodCodes) {
      const { data, error } = await client
        .from("foods")
        .select("id, source_ref")
        .eq("source", "cofid")
        .in("source_ref", [...foodCodes]);
      raiseOnFailure(error, "look up the foods");

      return new Map(
        (data ?? []).flatMap(({ id, source_ref }) =>
          source_ref === null ? [] : [[source_ref, id]],
        ),
      );
    },

    async clearDefaultsExcept(foodId, keepPortionId) {
      const { error } = await client
        .from("food_portions")
        .update({ is_default: false })
        .eq("food_id", foodId)
        .is("owner_id", null)
        .eq("is_default", true)
        .neq("id", keepPortionId);
      raiseOnFailure(error, "clear the old default portion");
    },

    async upsertPortions(portions) {
      const { error } = await client.from("food_portions").upsert(
        portions.map(({ id, foodId, label, grams, ml, isDefault, position }) => ({
          id,
          food_id: foodId,
          owner_id: null,
          label,
          grams,
          ml,
          is_default: isDefault,
          position,
        })),
        { onConflict: "id" },
      );
      raiseOnFailure(error, "upsert the portions");
    },
  };
}
