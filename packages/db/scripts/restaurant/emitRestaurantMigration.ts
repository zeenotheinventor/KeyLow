import { readFileSync } from "node:fs";

import { renderRestaurantMigration } from "./renderRestaurantMigration";
import { writeNewMigration } from "../exercises/writeNewMigration";

/** Renders the restaurant CSV up to a wave as a migration, and writes it to a path that must not hold a file yet. */
export function emitRestaurantMigration(options: {
  csvPath: string;
  outputPath: string;
  wave: number;
}): void {
  writeNewMigration(
    options.outputPath,
    renderRestaurantMigration(readFileSync(options.csvPath, "utf8"), options.wave),
  );
}
