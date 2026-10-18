// Imports the curated exercise library (data/exercises/exercises.curated.csv) into the exercise tables.
//
// It runs the checker on the CSV first and writes nothing if the CSV fails. The target is
// SUPABASE_URL with SUPABASE_SERVICE_ROLE_KEY, or the local stack when neither is set. Exercises are
// upserted on (source, source_ref) together with their muscle maps, with one import run and one
// source row each. Running it again with the same CSV changes nothing. A changed map replaces that
// exercise's map. An exercise the CSV no longer has is soft deleted, never deleted.
//
//   --dry-run   maps and checks every row and writes nothing, and connects to nothing.
//   --emit-sql  writes the same library as an idempotent SQL seed file at that path, and connects to nothing.
//
//   pnpm --filter @keylow/db import:exercises --label local-full
//   pnpm --filter @keylow/db import:exercises --label local-full --dry-run
//   pnpm --filter @keylow/db import:exercises --label seed --emit-sql supabase/seeds/40_exercises.sql
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parseArgs } from "node:util";

import { createClient } from "@supabase/supabase-js";

import { resolveConnection } from "./cofid/connection";
import { readExerciseLibrary, renderExerciseSeed } from "./exercises/exerciseLibrary";
import { SOURCE_COMMIT } from "./exercises/files";
import { importExercises } from "./exercises/importExercises";
import { createSupabaseExerciseStore } from "./exercises/supabaseExerciseStore";
import { readSupabaseStatus } from "./supabaseStatus";

import type { ExerciseImportStore } from "./exercises/importExercises";
import type { Database } from "../src/types.gen";

// A batch is one call of import_exercises. An exercise with its source row is about 1.5 kB of JSON,
// so a batch of 100 stays near 150 kB, well inside what PostgREST accepts.
const BATCH_SIZE = 100;

const usage = `Usage:
  import-exercises.ts --label <label> [--dry-run]
  import-exercises.ts --label <label> --emit-sql <seed file>`;

const storeThatMustNotBeUsed: ExerciseImportStore = {
  startRun: () => Promise.reject(new Error("A dry run must not write")),
  writeBatch: () => Promise.reject(new Error("A dry run must not write")),
  listLiveSourceRefs: () => Promise.reject(new Error("A dry run must not read")),
  softDelete: () => Promise.reject(new Error("A dry run must not write")),
  finishRun: () => Promise.reject(new Error("A dry run must not write")),
  recordRowCount: () => Promise.reject(new Error("A dry run must not write")),
};

async function runImport(options: {
  label: string;
  emitSqlPath: string | undefined;
  dryRun: boolean;
}): Promise<void> {
  const { label, emitSqlPath, dryRun } = options;
  // run-typescript.ts sets argv[1] to this file, so the package directory is its parent's parent.
  const packageDirectory = resolve(dirname(process.argv[1] ?? "."), "..");
  const library = readExerciseLibrary(packageDirectory);
  const startedAt = Date.now();
  const seconds = (): string => ((Date.now() - startedAt) / 1000).toFixed(1);

  if (emitSqlPath !== undefined) {
    writeFileSync(emitSqlPath, await renderExerciseSeed(library, label, console.log));
    console.log(`Wrote ${emitSqlPath} in ${seconds()} s`);
    return;
  }

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
      "emit-sql": { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
  });

  if (values.label !== undefined && !(values["emit-sql"] !== undefined && values["dry-run"])) {
    await runImport({
      label: values.label,
      emitSqlPath: values["emit-sql"],
      dryRun: values["dry-run"],
    });
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
