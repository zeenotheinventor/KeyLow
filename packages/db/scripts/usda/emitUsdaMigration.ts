import { readFileSync } from "node:fs";

import { renderUsdaMigration } from "./renderUsdaMigration";
import { writeNewMigration } from "../exercises/writeNewMigration";

// The migration the render writes loads foods and their natural portions, and some foods end with no default.
// This call gives each one, with the function that holds core's estimate statements (KEY-946).
const GIVE_DEFAULT_PORTIONS = [
  "",
  "-- Every food ends on one default portion, whichever source or import wrote it (KEY-946). Foods that already have a default keep it.",
  "select public.give_foods_default_portions();",
  "",
].join("\n");

/**
 * Renders the normalised CSV as a migration, followed by the call that gives every food a default portion,
 * and writes it to a path that must not hold a file yet.
 */
export function emitUsdaMigration(options: { csvPath: string; outputPath: string }): void {
  writeNewMigration(
    options.outputPath,
    `${renderUsdaMigration(readFileSync(options.csvPath, "utf8"))}${GIVE_DEFAULT_PORTIONS}`,
  );
}
