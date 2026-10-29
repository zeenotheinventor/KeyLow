// Normalises the USDA SR Legacy foods in the curated list into one committed CSV, the way import-cofid.ts
// normalises the CoFID workbook. Later steps read only that CSV and never need the zip again.
//
//   normalise  Reads the foods in the curated list from an unpacked SR Legacy CSV folder and writes
//              usda-sr-legacy.normalised.csv and its .sha256 file. The same input always gives the same bytes.
//              --sr is the folder holding food.csv, food_category.csv, nutrient.csv, food_nutrient.csv and
//              food_portion.csv. --zip refuses to run unless the zip is the April 2018 release. --list and
//              --out change the curated list and the CSV, which are under data/usda by default.
//
//   emit-migration  Writes the foods in the normalised CSV, and their natural portions, as an idempotent SQL
//              migration and connects to nothing. This is how production gets them: Deploy Supabase applies the
//              migration on merge, so nobody runs anything against production. --csv is the normalised CSV and --out
//              the migration. A change to the CSV is a NEW migration with a later timestamp. An applied migration is
//              never edited, and --out must not hold a file yet.
//
//   pnpm --filter @keylow/db import:usda normalise --sr <unpacked SR folder>
//   pnpm --filter @keylow/db import:usda normalise --sr <unpacked SR folder> --zip ~/Downloads/FoodData_Central_sr_legacy_food_csv_2018-04.zip
//   pnpm --filter @keylow/db import:usda emit-migration --csv data/usda/usda-sr-legacy.normalised.csv --out supabase/migrations/<timestamp>_usda_foods.sql
//
// The folder comes from FoodData_Central_sr_legacy_food_csv_2018-04.zip (fdc.nal.usda.gov, CC0). Neither the
// zip nor the raw CSVs are committed.
import { parseArgs } from "node:util";

import { emitUsdaMigration } from "./usda/emitUsdaMigration";
import { runNormalise } from "./usda/normalise";

const DEFAULT_LIST_PATH = "data/usda/usda-foods.csv";
const DEFAULT_OUTPUT_PATH = "data/usda/usda-sr-legacy.normalised.csv";

const usage = `Usage:
  import-usda.ts normalise --sr <unpacked SR Legacy folder> [--zip <zip>] [--list <csv>] [--out <csv>]
  import-usda.ts emit-migration --csv <normalised csv> --out <migration file>`;

async function main(): Promise<void> {
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: {
      sr: { type: "string" },
      zip: { type: "string" },
      list: { type: "string" },
      out: { type: "string" },
      csv: { type: "string" },
    },
  });
  const [command] = positionals;

  if (command === "emit-migration" && values.csv !== undefined && values.out !== undefined) {
    emitUsdaMigration({ csvPath: values.csv, outputPath: values.out });
    console.log(`Wrote ${values.out}`);
    return;
  }

  if (command !== "normalise" || values.sr === undefined) {
    console.error(usage);
    process.exitCode = 2;
    return;
  }

  const outputPath = values.out ?? DEFAULT_OUTPUT_PATH;
  const { sha256, summary } = await runNormalise({
    srDirectory: values.sr,
    listPath: values.list ?? DEFAULT_LIST_PATH,
    outputPath,
    ...(values.zip === undefined ? {} : { zipPath: values.zip }),
  });
  console.log(`Wrote ${outputPath}`);
  console.log(
    `  ${summary.foodCount} foods, ${summary.portionCount} with a portion, sha256 ${sha256}`,
  );
}

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
