import { readFileSync } from "node:fs";

import { renderUsdaMigration } from "./renderUsdaMigration";
import { writeNewMigration } from "../exercises/writeNewMigration";

/** Renders the normalised CSV as a migration and writes it to a path that must not hold a file yet. */
export function emitUsdaMigration(options: { csvPath: string; outputPath: string }): void {
  writeNewMigration(options.outputPath, renderUsdaMigration(readFileSync(options.csvPath, "utf8")));
}
