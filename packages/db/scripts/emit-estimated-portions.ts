// Writes the SQL that gives every food a default portion that is not grams. It connects to nothing.
//
//   pnpm --filter @keylow/db emit:estimated-portions supabase/migrations/<timestamp>_estimated_portions.sql
//   pnpm --filter @keylow/db emit:estimated-portions --seed supabase/seeds/90_estimated_portions.sql
//   pnpm --filter @keylow/db emit:estimated-portions --function supabase/migrations/<timestamp>_give_foods_default_portions.sql
//
// A migration path must not hold a file yet, because an applied migration is never regenerated, and a change
// to the estimate table in @keylow/core is a NEW migration with a later timestamp. The seed is never applied
// to production, so `--seed` rewrites the file. `--function` writes the migration that wraps the same statements in
// public.give_foods_default_portions(), which the food imports call, and its path must not hold a file either.
import { writeFileSync } from "node:fs";

import { writeNewMigration } from "./exercises/writeNewMigration";
import {
  renderEstimatedPortionMigration,
  renderEstimatedPortionSeed,
  renderGiveFoodsDefaultPortionsMigration,
} from "./portions/renderEstimatedPortionMigration";

const [first, second] = process.argv.slice(2);
const isSeed = first === "--seed";
const isFunction = first === "--function";
const path = isSeed || isFunction ? second : first;

if (path === undefined) {
  console.error("Usage: emit-estimated-portions.ts [--seed | --function] <file>");
  process.exitCode = 2;
} else {
  if (isSeed) {
    writeFileSync(path, renderEstimatedPortionSeed());
  } else if (isFunction) {
    writeNewMigration(path, renderGiveFoodsDefaultPortionsMigration());
  } else {
    writeNewMigration(path, renderEstimatedPortionMigration());
  }
  console.log(`Wrote ${path}`);
}
