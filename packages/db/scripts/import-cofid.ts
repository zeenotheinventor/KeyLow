// Normalises the CoFID workbook into one CSV, and imports that CSV into the foods tables.
//
//   normalise  Reads the workbook and writes <name>.normalised.csv and <name>.normalised.csv.sha256
//              next to it, or at --out. The same workbook always gives the same bytes.
//   import     Reads a normalised CSV and upserts its foods, their source data and one import run.
//              The target is SUPABASE_URL with SUPABASE_SERVICE_ROLE_KEY, or the local stack when
//              neither is set. --dry-run maps and checks every row and writes nothing. --subset
//              limits the import to the codes in a file (one per line, # starts a comment).
//
//   pnpm --filter @keylow/db import:cofid normalise --xlsx data/cofid/cofid-2021.xlsx
//   pnpm --filter @keylow/db import:cofid import --csv data/cofid/cofid-2021.normalised.csv --label local-full-2021
import { execFile } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, join } from "node:path";
import { parseArgs, promisify } from "node:util";

import { createClient } from "@supabase/supabase-js";

import { formatChecksumFile, parseChecksumFile, sha256Hex } from "./cofid/checksum";
import { resolveConnection } from "./cofid/connection";
import { importCofid } from "./cofid/importFoods";
import { normaliseWorkbook } from "./cofid/normalise";
import { parseSubsetFile } from "./cofid/subset";
import { createSupabaseImportStore } from "./cofid/supabaseImportStore";

import type { ImportStore } from "./cofid/importFoods";
import type { Database } from "../src/types.gen";

// Each batch is one foods upsert and one source data upsert. A food's raw row is about 10 kB of JSON,
// so a batch of 100 stays near a megabyte, well inside what PostgREST accepts.
const BATCH_SIZE = 100;

const usage = `Usage:
  import-cofid.ts normalise --xlsx <workbook> [--out <csv>]
  import-cofid.ts import --csv <csv> --label <label> [--subset <codes file>] [--dry-run]`;

async function runNormalise(xlsxPath: string, outputPath: string | undefined): Promise<void> {
  const csvPath =
    outputPath ??
    join(dirname(xlsxPath), `${basename(xlsxPath, extname(xlsxPath))}.normalised.csv`);
  const { csv, sha256, summary } = await normaliseWorkbook(xlsxPath);

  writeFileSync(csvPath, csv);
  writeFileSync(`${csvPath}.sha256`, formatChecksumFile(sha256, basename(csvPath)));

  console.log(`Wrote ${csvPath} (${csv.length} characters)`);
  console.log(`  ${summary.foodCount} foods, ${summary.columnCount} columns, sha256 ${sha256}`);
  console.log(`  cells: ${JSON.stringify(summary.cells)}`);
  console.log(`  codes that appear more than once: ${summary.duplicateCodes.join(", ") || "none"}`);
  for (const { code, column, text } of summary.bracketedCells) {
    console.log(`  bracketed cell: ${code} ${column} ${text}`);
  }
  for (const { code, sheet, column } of summary.identityDifferences) {
    console.log(`  ${sheet} gives food ${code} a different ${column} from proximates`);
  }
}

async function readLocalStatus(): Promise<unknown> {
  const { stdout } = await promisify(execFile)(
    "supabase",
    ["status", "--workdir", process.cwd(), "--output", "json"],
    { timeout: 30_000 },
  );
  // The CLI can print notices before the JSON document.
  return JSON.parse(stdout.slice(stdout.indexOf("{")));
}

/** The CSV is checked against its .sha256 file when it has one, so a hand-edited CSV is not imported as the published one. */
function readCsv(csvPath: string): { csv: string; sha256: string } {
  const bytes = readFileSync(csvPath);
  const sha256 = sha256Hex(bytes);
  const checksumPath = `${csvPath}.sha256`;

  if (existsSync(checksumPath)) {
    const expected = parseChecksumFile(readFileSync(checksumPath, "utf8"));
    if (expected !== sha256) {
      throw new Error(`${csvPath} has sha256 ${sha256}, but ${checksumPath} says ${expected}`);
    }
  }
  return { csv: bytes.toString("utf8"), sha256 };
}

const storeThatMustNotBeUsed: ImportStore = {
  startRun: () => Promise.reject(new Error("A dry run must not write")),
  writeBatch: () => Promise.reject(new Error("A dry run must not write")),
  finishRun: () => Promise.reject(new Error("A dry run must not write")),
  recordRowCount: () => Promise.reject(new Error("A dry run must not write")),
};

async function runImport(options: {
  csvPath: string;
  label: string;
  subsetPath: string | undefined;
  dryRun: boolean;
}): Promise<void> {
  const { csvPath, label, subsetPath, dryRun } = options;
  const { csv, sha256 } = readCsv(csvPath);
  const subsetCodes =
    subsetPath === undefined ? undefined : parseSubsetFile(readFileSync(subsetPath, "utf8"));

  let store = storeThatMustNotBeUsed;
  if (!dryRun) {
    const { url, serviceRoleKey } = await resolveConnection(process.env, readLocalStatus);
    console.log(`Importing into ${url}`);
    store = createSupabaseImportStore(
      createClient<Database>(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }),
    );
  }

  const startedAt = Date.now();
  const summary = await importCofid(store, {
    csv,
    fileSha256: sha256,
    label,
    ...(subsetCodes === undefined ? {} : { subsetCodes }),
    dryRun,
    batchSize: BATCH_SIZE,
    log: console.log,
  });
  const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log(
    `Done: ${summary.rowCount} foods in ${seconds} s${summary.runId === undefined ? "" : `, import run ${summary.runId}`}`,
  );
}

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      xlsx: { type: "string" },
      out: { type: "string" },
      csv: { type: "string" },
      label: { type: "string" },
      subset: { type: "string" },
      "dry-run": { type: "boolean", default: false },
    },
  });
  const [command] = positionals;

  if (command === "normalise" && values.xlsx !== undefined) {
    await runNormalise(values.xlsx, values.out);
  } else if (command === "import" && values.csv !== undefined && values.label !== undefined) {
    await runImport({
      csvPath: values.csv,
      label: values.label,
      subsetPath: values.subset,
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
