import { readCuratedExercises } from "./readCuratedExercises";

import type { ImportRow } from "./importExercise";
import type { Json } from "../../src/types.gen";

/** What one batch did to the exercises it named. */
export type BatchOutcome = { created: number; updated: number; unchanged: number };

/**
 * Where an import writes to. The Supabase implementation is in supabaseExerciseStore.ts, and the
 * generator of an idempotent SQL migration file is another one.
 */
export type ExerciseImportStore = {
  /** Inserts the `exercise_import_runs` row and returns its id. */
  startRun(run: { label: string; sourceCommit: string; fileSha256: string }): Promise<string>;
  /**
   * Writes each exercise together with its muscle map and its source row, all or nothing for the
   * batch. An exercise is created, or updated when anything about it differs, and a map that has
   * not changed is left alone.
   */
  writeBatch(runId: string, batch: readonly ImportRow[]): Promise<BatchOutcome>;
  /** The `source_ref` of every global exercise that is not soft deleted. */
  listLiveSourceRefs(): Promise<string[]>;
  /** Sets `deleted_at` on these global exercises. Nothing is ever hard deleted. */
  softDelete(sourceRefs: readonly string[]): Promise<void>;
  /** Sets `finished_at` and `row_count`. A run with `finished_at` null is therefore an incomplete one. */
  finishRun(runId: string, result: { rowCount: number }): Promise<void>;
  /** Sets `row_count` only, for a run that failed part way. `finished_at` stays null. */
  recordRowCount(runId: string, result: { rowCount: number }): Promise<void>;
};

export type ImportOptions = {
  csv: string;
  /** The source file's entries by id, which become the provenance rows. */
  sourceRows: ReadonlyMap<string, Json>;
  /** The commit of the source repository the pinned file was taken from. */
  sourceCommit: string;
  /** The sha256 of `csv`. */
  fileSha256: string;
  label: string;
  dryRun: boolean;
  batchSize: number;
  log: (message: string) => void;
};

export type ImportSummary = BatchOutcome & {
  /** Undefined for a dry run, which writes no run. */
  runId: string | undefined;
  /** The exercises written, or for a dry run the exercises that would be. */
  rowCount: number;
  softDeleted: number;
};

// Health data: no exercise name, source reference or muscle value goes into a log line or an error.
// Only counts do. A failure from the store arrives here already free of values.
const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

function readRows(options: ImportOptions): ImportRow[] {
  const exercises = readCuratedExercises(options.csv);
  const rows: ImportRow[] = [];
  let withoutSourceRow = 0;
  for (const exercise of exercises) {
    const raw = options.sourceRows.get(exercise.sourceRef);
    if (raw === undefined) {
      withoutSourceRow += 1;
    } else {
      rows.push({ ...exercise, raw });
    }
  }
  if (withoutSourceRow > 0) {
    throw new Error(
      `${withoutSourceRow} curated exercises have no row in the source file, so nothing was written`,
    );
  }
  return rows;
}

/**
 * Imports the curated exercise CSV. The checker runs first and every row is mapped before anything
 * is written. The run is recorded first and finished last. When a batch fails, the run keeps the
 * number of exercises written but is not finished, so `finished_at` null marks an incomplete run,
 * nothing is soft deleted, and the failure is thrown. After the last batch, the live global
 * exercises that the CSV no longer has are soft deleted. A dry run maps and counts but writes nothing.
 */
export async function importExercises(
  store: ExerciseImportStore,
  options: ImportOptions,
): Promise<ImportSummary> {
  const { sourceCommit, fileSha256, label, dryRun, batchSize, log } = options;
  if (label.trim() === "") {
    throw new Error("The label must not be empty");
  }

  const rows = readRows(options);
  const totals: BatchOutcome = { created: 0, updated: 0, unchanged: 0 };

  if (dryRun) {
    log(`Dry run: ${rows.length} exercises mapped and checked, nothing written`);
    return { runId: undefined, rowCount: rows.length, ...totals, softDeleted: 0 };
  }

  const runId = await store.startRun({ label, sourceCommit, fileSha256 });
  let written = 0;
  let softDeleted = 0;
  let failure: Error | undefined;

  try {
    for (let start = 0; start < rows.length; start += batchSize) {
      const batch = rows.slice(start, start + batchSize);
      const outcome = await store.writeBatch(runId, batch);
      totals.created += outcome.created;
      totals.updated += outcome.updated;
      totals.unchanged += outcome.unchanged;
      written += batch.length;
      log(`Imported ${written} of ${rows.length} exercises`);
    }

    const kept = new Set(rows.map(({ sourceRef }) => sourceRef));
    const removed = (await store.listLiveSourceRefs()).filter((sourceRef) => !kept.has(sourceRef));
    if (removed.length > 0) {
      await store.softDelete(removed);
      softDeleted = removed.length;
      log(`Soft deleted ${softDeleted} exercises that the CSV no longer has`);
    }
  } catch (error) {
    failure = error instanceof Error ? error : new Error(String(error));
    log(`Failed after ${written} of ${rows.length} exercises: ${describeError(error)}`);
  }

  if (failure === undefined) {
    await store.finishRun(runId, { rowCount: written });
    return { runId, rowCount: written, ...totals, softDeleted };
  }
  // The run keeps what was written and stays unfinished. A failure to record that must not hide the real failure.
  await store.recordRowCount(runId, { rowCount: written }).catch(() => undefined);
  throw failure;
}
