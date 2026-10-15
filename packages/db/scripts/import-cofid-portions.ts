// Loads the curated natural portions (1 medium banana, 1 thigh) for CoFID foods into food_portions.
//
//   --file <csv>       The portions file, for example data/portions/cofid-portions.csv. Required.
//   --dry-run          Looks the foods up and prints what would be written. Writes nothing.
//   --emit-sql <path>  Writes the same portions as an idempotent SQL seed file and connects to nothing.
//   --strict           Exits 1 when a food code in the file has no food in the database.
//
// The target is SUPABASE_URL with SUPABASE_SERVICE_ROLE_KEY, or the local stack when neither is set.
// A portion is written under an id made from its food code and label, so running this again changes
// nothing and a corrected weight updates the same row. Portions the file no longer lists are kept.
//
//   pnpm --filter @keylow/db import:portions --file data/portions/cofid-portions.csv --dry-run
//   pnpm --filter @keylow/db import:portions --file data/portions/cofid-portions.csv --emit-sql supabase/seeds/30_cofid_portions.sql
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { createClient } from "@supabase/supabase-js";

import { resolveConnection } from "./cofid/connection";
import { importPortions } from "./portions/importPortions";
import { parsePortionRows } from "./portions/portionRows";
import { renderPortionSeed } from "./portions/renderPortionSeed";
import { createSupabasePortionStore } from "./portions/supabasePortionStore";
import { readSupabaseStatus } from "./supabaseStatus";

import type { Database } from "../src/types.gen";

const usage = `Usage:
  import-cofid-portions.ts --file <csv> [--dry-run] [--strict]
  import-cofid-portions.ts --file <csv> --emit-sql <seed file>`;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      file: { type: "string" },
      "dry-run": { type: "boolean", default: false },
      "emit-sql": { type: "string" },
      strict: { type: "boolean", default: false },
    },
  });
  const emitSqlPath = values["emit-sql"];

  if (
    values.file === undefined ||
    (emitSqlPath !== undefined && (values["dry-run"] || values.strict))
  ) {
    console.error(usage);
    process.exitCode = 2;
    return;
  }

  const rows = parsePortionRows(readFileSync(values.file, "utf8"));

  if (emitSqlPath !== undefined) {
    writeFileSync(emitSqlPath, renderPortionSeed(rows));
    console.log(`Wrote ${emitSqlPath}: ${rows.length} portions`);
    return;
  }

  const { url, serviceRoleKey } = await resolveConnection(process.env, () =>
    readSupabaseStatus(process.cwd()),
  );
  console.log(`${values["dry-run"] ? "Checking" : "Loading into"} ${url}`);
  const store = createSupabasePortionStore(
    createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    }),
  );

  const summary = await importPortions(store, {
    rows,
    dryRun: values["dry-run"],
    log: console.log,
  });
  console.log(
    `Done: ${summary.foodsMatched} foods matched, ${summary.rowsWritten} rows written, ${summary.missingFoodCodes.length} food codes not found`,
  );
  if (values.strict && summary.missingFoodCodes.length > 0) {
    process.exitCode = 1;
  }
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
