// Imports the curated exercise library (data/exercises/exercises.curated.csv) into the exercise tables.
//
// It runs the checker on the CSV first and writes nothing if the CSV fails. The target is
// SUPABASE_URL with SUPABASE_SERVICE_ROLE_KEY, or the local stack when neither is set. Exercises are
// upserted on (source, source_ref) together with their muscle maps, with one import run and one
// source row each. Running it again with the same CSV changes nothing. A changed map replaces that
// exercise's map. An exercise the CSV no longer has is soft deleted, never deleted.
//
//   --dry-run         maps and checks every row and writes nothing, and connects to nothing.
//   --emit-migration  writes the same library as an idempotent SQL migration at that path, and connects to
//                     nothing. It takes no label, because the migration records its own.
//
//   pnpm --filter @keylow/db import:exercises --label local-full
//   pnpm --filter @keylow/db import:exercises --label local-full --dry-run
//   pnpm --filter @keylow/db import:exercises --emit-migration supabase/migrations/<timestamp>_exercise_library.sql
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

import { createClient } from "@supabase/supabase-js";

import { resolveConnection } from "./cofid/connection";
import { readExerciseLibrary, renderExerciseMigration } from "./exercises/exerciseLibrary";
import { SOURCE_COMMIT } from "./exercises/files";
import { importExercises } from "./exercises/importExercises";
import { createSupabaseExerciseStore } from "./exercises/supabaseExerciseStore";
import { writeNewMigration } from "./exercises/writeNewMigration";
import { readSupabaseStatus } from "./supabaseStatus";

import type { ExerciseLibrary } from "./exercises/exerciseLibrary";
import type { ExerciseImportStore } from "./exercises/importExercises";
import type { Database } from "../src/types.gen";

// A batch is one call of import_exercises. An exercise with its source row is about 1.5 kB of JSON,
// so a batch of 100 stays near 150 kB, well inside what PostgREST accepts.
const BATCH_SIZE = 100;

const usage = `Usage:
  import-exercises.ts --label <label> [--dry-run]
  import-exercises.ts --emit-migration <migration file>`;

const storeThatMustNotBeUsed: ExerciseImportStore = {
  startRun: () => Promise.reject(new Error("A dry run must not write")),
  writeBatch: () => Promise.reject(new Error("A dry run must not write")),
  listLiveSourceRefs: () => Promise.reject(new Error("A dry run must not read")),
  softDelete: () => Promise.reject(new Error("A dry run must not write")),
  finishRun: () => Promise.reject(new Error("A dry run must not write")),
  recordRowCount: () => Promise.reject(new Error("A dry run must not write")),
};

// run-typescript.ts sets argv[1] to this file, so the package directory is its parent's parent.
const readLibrary = (): ExerciseLibrary =>
  readExerciseLibrary(resolve(dirname(process.argv[1] ?? "."), ".."));

async function emitMigration(path: string): Promise<void> {
  const startedAt = Date.now();
  writeNewMigration(path, await renderExerciseMigration(readLibrary(), console.log));
  console.log(`Wrote ${path} in ${((Date.now() - startedAt) / 1000).toFixed(1)} s`);
}

async function runImport(options: { label: string; dryRun: boolean }): Promise<void> {
  const { label, dryRun } = options;
  const library = readLibrary();
  const startedAt = Date.now();
  const seconds = (): string => ((Date.now() - startedAt) / 1000).toFixed(1);

  let store = storeThatMustNotBeUsed;
  if (!dryRun) {
    const { url, serviceRoleKey } = await resolveConnection(process.env, () =>
      readSupabaseStatus(process.cwd()),
    );
    console.log(`Importing into ${url}`);
    store = createSupabaseExerciseStore(
      createClient<Database>(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    );
  }

  const summary = await importExercises(store, {
    ...library,
    sourceCommit: SOURCE_COMMIT,
    label,
    dryRun,
    batchSize: BATCH_SIZE,
    log: console.log,
  });

  console.log(
    `Done: ${summary.rowCount} exercises in ${seconds()} s, ${summary.created} created, ${summary.updated} updated, ${summary.unchanged} unchanged, ${summary.softDeleted} soft deleted${summary.runId === undefined ? "" : `, import run ${summary.runId}`}`,
  );
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      label: { type: "string" },
      "emit-migration": { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
  });
  const migrationPath = values["emit-migration"];

  if (migrationPath !== undefined && values.label === undefined && !values["dry-run"]) {
    await emitMigration(migrationPath);
  } else if (migrationPath === undefined && values.label !== undefined) {
    await runImport({ label: values.label, dryRun: values["dry-run"] });
  } else {
    console.error(usage);
    process.exitCode = 2;
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
