import type { ImportStore } from "./importFoods";
import type { Database } from "../../src/types.gen";
import type { SupabaseClient } from "@supabase/supabase-js";

type Failure = { message: string } | null;

function raiseOnFailure(error: Failure, action: string): void {
  if (error) {
    throw new Error(`Could not ${action}: ${error.message}`, { cause: error });
  }
}

/** Writes through PostgREST with a service role client, which is the only role allowed to write global foods. */
export function createSupabaseImportStore(client: SupabaseClient<Database>): ImportStore {
  return {
    async startRun({ label, fileSha256 }) {
      const { data, error } = await client
        .from("import_runs")
        .insert({ source: "cofid", label, file_sha256: fileSha256 })
        .select("id")
        .single();
      raiseOnFailure(error, "record the import run");
      if (data === null) {
        throw new Error("Could not record the import run: no row came back");
      }
      return data.id;
    },

    async writeBatch(runId, batch) {
      const { data: foods, error: foodsError } = await client
        .from("foods")
        .upsert(
          batch.map(({ food }) => food),
          { onConflict: "source,source_ref" },
        )
        .select("id, source_ref");
      raiseOnFailure(foodsError, "upsert the foods");

      const idsBySourceRef = new Map(
        (foods ?? []).flatMap(({ id, source_ref }) =>
          source_ref === null ? [] : [[source_ref, id]],
        ),
      );
      const sourceData = batch.map(({ sourceRef, raw }) => {
        const foodId = idsBySourceRef.get(sourceRef);
        if (foodId === undefined) {
          throw new Error(`The database returned no id for food ${sourceRef}`);
        }
        return { food_id: foodId, import_run_id: runId, raw };
      });

      const { error: sourceDataError } = await client
        .from("food_source_data")
        .upsert(sourceData, { onConflict: "food_id" });
      raiseOnFailure(sourceDataError, "upsert the source data");
    },

    async finishRun(runId, { rowCount }) {
      const { error } = await client
        .from("import_runs")
        .update({ finished_at: new Date().toISOString(), row_count: rowCount })
        .eq("id", runId);
      raiseOnFailure(error, "finish the import run");
    },

    async recordRowCount(runId, { rowCount }) {
      const { error } = await client
        .from("import_runs")
        .update({ row_count: rowCount })
        .eq("id", runId);
      raiseOnFailure(error, "record the import run's row count");
    },
  };
}
