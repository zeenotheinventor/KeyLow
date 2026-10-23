import { readdirSync, readFileSync } from "node:fs";

const migrationsDirectory = new URL("../../supabase/migrations/", import.meta.url);

/** The name ending of the generated migrations that load the CoFID portions, such as `20261023120000_cofid_portions.sql`. */
const PORTION_MIGRATION_SUFFIX = "_cofid_portions.sql";

/** The newest generated portions migration. Migrations are named by timestamp, so the last in name order is the newest. */
export function readNewestPortionMigration(): { name: string; sql: string } {
  const name = readdirSync(migrationsDirectory)
    .filter((fileName) => fileName.endsWith(PORTION_MIGRATION_SUFFIX))
    .sort()
    .at(-1);
  if (name === undefined) {
    throw new Error(`There is no ${PORTION_MIGRATION_SUFFIX} migration`);
  }
  return { name, sql: readFileSync(new URL(name, migrationsDirectory), "utf8") };
}
