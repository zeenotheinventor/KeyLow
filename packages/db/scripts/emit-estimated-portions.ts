// Writes the migration that gives every food a default portion that is not grams. It connects to nothing.
//
//   pnpm --filter @keylow/db emit:estimated-portions supabase/migrations/<timestamp>_estimated_portions.sql
//
// The path must not hold a file yet, because an applied migration is never regenerated. A change to the
// estimate table in @keylow/core is a NEW migration with a later timestamp.
import { writeNewMigration } from "./exercises/writeNewMigration";
import { renderEstimatedPortionMigration } from "./portions/renderEstimatedPortionMigration";

const [path] = process.argv.slice(2);

if (path === undefined) {
  console.error("Usage: emit-estimated-portions.ts <migration file>");
  process.exitCode = 2;
} else {
  writeNewMigration(path, renderEstimatedPortionMigration());
  console.log(`Wrote ${path}`);
}
