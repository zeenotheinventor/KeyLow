// Writes the restaurant foods of the committed CSV as an idempotent SQL migration, the way import-usda.ts does
// for the USDA foods. It connects to nothing. This is how production gets them: Deploy Supabase applies the
// migration on merge, so nobody runs anything against production.
//
//   emit-migration  --wave is the last wave to include, and the migration holds every row up to it. --out is
//              the migration, and it must not hold a file yet, because an applied migration is never edited.
//              --csv changes the CSV, which is data/restaurants/restaurant-foods.csv by default. A change to
//              the CSV, or a later wave, is a NEW migration with a later timestamp.
//
//   pnpm --filter @keylow/db import:restaurant emit-migration --wave 1 --out supabase/migrations/<timestamp>_restaurant_foods.sql
//
//   nandos-rows  prints the Nando's lines of the CSV, worked out from data/restaurants/nandos-estimates.json.
import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";

import { emitRestaurantMigration } from "./restaurant/emitRestaurantMigration";
import {
  parseNandosEstimates,
  readCofidReferences,
  renderNandosCsvRows,
} from "./restaurant/estimateNandosMacros";

const DEFAULT_CSV_PATH = "data/restaurants/restaurant-foods.csv";

const NANDOS_ESTIMATES_PATH = "data/restaurants/nandos-estimates.json";
const COFID_CSV_PATH = "data/cofid/cofid-2021.normalised.csv";

const usage = `Usage:
  import-restaurant.ts emit-migration --wave <n> --out <migration file> [--csv <csv>]
  import-restaurant.ts nandos-rows`;

/** Prints the Nando's lines of the CSV, worked out from data/restaurants/nandos-estimates.json. It connects to nothing. */
function printNandosRows(): void {
  const estimates = parseNandosEstimates(readFileSync(NANDOS_ESTIMATES_PATH, "utf8"));
  const references = readCofidReferences(
    readFileSync(COFID_CSV_PATH, "utf8"),
    estimates.items.flatMap((item) => item.components.map((component) => component.cofid_code)),
  );
  process.stdout.write(renderNandosCsvRows(estimates, references));
}

function main(): void {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      wave: { type: "string" },
      out: { type: "string" },
      csv: { type: "string" },
    },
  });
  const [command] = positionals;
  if (command === "nandos-rows") {
    printNandosRows();
    return;
  }
  const wave = Number(values.wave);

  if (command !== "emit-migration" || !Number.isInteger(wave) || values.out === undefined) {
    console.error(usage);
    process.exitCode = 2;
    return;
  }
  emitRestaurantMigration({
    csvPath: values.csv ?? DEFAULT_CSV_PATH,
    outputPath: values.out,
    wave,
  });
  console.log(`Wrote ${values.out}`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
