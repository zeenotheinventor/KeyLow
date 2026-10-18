import { toExercisePayload } from "./exercisePayload";

import type { BatchOutcome, ExerciseImportStore } from "./importExercises";
import type { Database, Json } from "../../src/types.gen";
import type { SupabaseClient } from "@supabase/supabase-js";

// PostgREST returns at most 1000 rows to a request, and a soft delete names its rows in the URL.
const PAGE_SIZE = 1000;
const SOFT_DELETE_CHUNK_SIZE = 100;

type Failure = { code: string } | null;

/**
 * Health data: a database error can quote a name or a muscle in its message and detail, so only
 * its SQLSTATE code is kept, and no cause is attached.
 */
function raiseOnFailure(error: Failure, action: string): void {
  if (error) {
    throw new Error(`Could not ${action} (database error ${error.code})`);
  }
}

function readOutcome(data: Json): BatchOutcome {
  if (typeof data === "object" && data !== null && !Array.isArray(data)) {
    const { created, updated, unchanged } = data;
    if (
      typeof created === "number" &&
      typeof updated === "number" &&
      typeof unchanged === "number"
    ) {
      return { created, updated, unchanged };
    }
  }
  throw new Error("Could not write the exercises: the database answered with an unexpected result");
}

/**
 * Writes through PostgREST with a service role client, which is the only role allowed to write global
 * exercises. Each batch is one call of `import_exercises`, because PostgREST gives every request its
 * own transaction and the primary-muscle rule is checked at commit, so an exercise and its map must
 * arrive in the same call.
 */
export function createSupabaseExerciseStore(client: SupabaseClient<Database>): ExerciseImportStore {
  return {
    async startRun({ label, sourceCommit, fileSha256 }) {
      const { data, error } = await client
        .from("exercise_import_runs")
        .insert({
          source: "free_exercise_db",
          label,
          source_commit: sourceCommit,
          file_sha256: fileSha256,
        })
        .select("id")
        .single();
      raiseOnFailure(error, "record the import run");
      if (data === null) {
        throw new Error("Could not record the import run: no row came back");
      }
      return data.id;
    },

    async writeBatch(runId, batch) {
      const { data, error } = await client.rpc("import_exercises", {
        p_import_run_id: runId,
        p_exercises: batch.map(toExercisePayload),
      });
      raiseOnFailure(error, "write the exercises");
      return readOutcome(data);
    },

    async listLiveSourceRefs() {
      const sourceRefs: string[] = [];
      for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await client
          .from("exercises")
          .select("source_ref")
          .eq("source", "free_exercise_db")
          .is("deleted_at", null)
          .order("source_ref")
          .range(from, from + PAGE_SIZE - 1);
        raiseOnFailure(error, "list the live exercises");
        for (const { source_ref } of data ?? []) {
          if (source_ref !== null) {
            sourceRefs.push(source_ref);
          }
        }
        if ((data ?? []).length < PAGE_SIZE) {
          return sourceRefs;
        }
      }
    },

    async softDelete(sourceRefs) {
      for (let start = 0; start < sourceRefs.length; start += SOFT_DELETE_CHUNK_SIZE) {
        const { error } = await client
          .from("exercises")
          .update({ deleted_at: new Date().toISOString() })
          .eq("source", "free_exercise_db")
          .in("source_ref", sourceRefs.slice(start, start + SOFT_DELETE_CHUNK_SIZE));
        raiseOnFailure(error, "soft delete the removed exercises");
      }
    },

    async finishRun(runId, { rowCount }) {
      const { error } = await client
        .from("exercise_import_runs")
        .update({ finished_at: new Date().toISOString(), row_count: rowCount })
        .eq("id", runId);
      raiseOnFailure(error, "finish the import run");
    },

    async recordRowCount(runId, { rowCount }) {
      const { error } = await client
        .from("exercise_import_runs")
        .update({ row_count: rowCount })
        .eq("id", runId);
      raiseOnFailure(error, "record the import run's row count");
    },
  };
}
