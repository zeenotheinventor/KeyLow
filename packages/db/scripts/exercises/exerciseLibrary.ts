import { readFileSync } from "node:fs";
import { join } from "node:path";

import { createExerciseMigrationStore } from "./exerciseMigrationStore";
import { EXERCISE_FILES, SOURCE_COMMIT } from "./files";
import { importExercises } from "./importExercises";
import { readPinnedFile } from "./pinnedSource";
import { readSourceRows } from "./readSourceRows";
import { sha256Hex } from "../cofid/checksum";

import type { Json } from "../../src/types.gen";

/** What an import reads: the curated CSV, its sha256, and the source file's entries by id. */
export type ExerciseLibrary = {
  csv: string;
  fileSha256: string;
  sourceRows: ReadonlyMap<string, Json>;
};

/** Reads the library from `data/exercises` under the given package directory. The source file must match its `.sha256`. */
export function readExerciseLibrary(packageDirectory: string): ExerciseLibrary {
  const csvBytes = readFileSync(join(packageDirectory, EXERCISE_FILES.curated));
  return {
    csv: csvBytes.toString("utf8"),
    fileSha256: sha256Hex(csvBytes),
    sourceRows: readSourceRows(
      readPinnedFile(join(packageDirectory, EXERCISE_FILES.source)).toString("utf8"),
    ),
  };
}

/** The label of the one import run a generated migration records. */
const MIGRATION_LABEL = "migration";

/** The whole library as the text of an idempotent SQL migration. Connects to nothing. */
export async function renderExerciseMigration(
  library: ExerciseLibrary,
  log: (message: string) => void = () => undefined,
): Promise<string> {
  const store = createExerciseMigrationStore();
  await importExercises(store, {
    ...library,
    sourceCommit: SOURCE_COMMIT,
    label: MIGRATION_LABEL,
    dryRun: false,
    batchSize: 100,
    log,
  });
  return store.render();
}
