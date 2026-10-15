import { portionId } from "./portionId";

import type { PortionRow } from "./portionRows";

/** A row of `food_portions` the loader writes. `owner_id` is always null, so it is not here. */
export type PortionWrite = {
  id: string;
  foodId: string;
  label: string;
  grams: number | null;
  ml: number | null;
  isDefault: boolean;
  position: number;
};

/** What the loader needs from a database. The loader itself holds no connection, so a test can hand it a fake. */
export type PortionStore = {
  /** The id of each CoFID food that exists, by its code. A code with no food is left out. */
  findFoodIds(foodCodes: readonly string[]): Promise<ReadonlyMap<string, string>>;
  /** Clears `is_default` on every global portion of the food except the one to keep. */
  clearDefaultsExcept(foodId: string, keepPortionId: string): Promise<void>;
  /** Inserts the portions, or updates them where the id already exists. */
  upsertPortions(portions: readonly PortionWrite[]): Promise<void>;
};

export type ImportPortionsSummary = {
  foodsMatched: number;
  rowsWritten: number;
  missingFoodCodes: string[];
};

type ImportPortionsOptions = {
  rows: readonly PortionRow[];
  dryRun: boolean;
  log: (message: string) => void;
};

const BATCH_SIZE = 100;

/**
 * Writes the file's portions under their deterministic ids. A row whose food is missing is skipped and
 * reported. A food's default is cleared before its rows are written, because the database allows one
 * default per food at a time and the new default can be written before the old one is cleared in a
 * batch. A portion the file no longer lists is left alone. A dry run looks the foods up and writes nothing.
 */
export async function importPortions(
  store: PortionStore,
  { rows, dryRun, log }: ImportPortionsOptions,
): Promise<ImportPortionsSummary> {
  const foodCodes = [...new Set(rows.map(({ foodCode }) => foodCode))];
  const foodIds = await store.findFoodIds(foodCodes);
  const missingFoodCodes = foodCodes.filter((foodCode) => !foodIds.has(foodCode));

  const writes = rows.flatMap((row): PortionWrite[] => {
    const foodId = foodIds.get(row.foodCode);
    return foodId === undefined
      ? []
      : [
          {
            id: portionId(row.foodCode, row.label),
            foodId,
            label: row.label,
            grams: row.grams,
            ml: row.ml,
            isDefault: row.isDefault,
            position: row.position,
          },
        ];
  });
  const foodsMatched = foodCodes.length - missingFoodCodes.length;

  if (dryRun) {
    log(
      `Dry run: ${foodsMatched} foods matched, ${writes.length} rows would be written, nothing was written`,
    );
  } else {
    for (const { foodId, id } of writes.filter(({ isDefault }) => isDefault)) {
      await store.clearDefaultsExcept(foodId, id);
    }
    for (let start = 0; start < writes.length; start += BATCH_SIZE) {
      await store.upsertPortions(writes.slice(start, start + BATCH_SIZE));
    }
    log(`Wrote ${writes.length} portions for ${foodsMatched} foods`);
  }

  if (missingFoodCodes.length > 0) {
    log(
      `Not found in this database, so skipped (${missingFoodCodes.length}): ${missingFoodCodes.join(", ")}`,
    );
  }
  return { foodsMatched, rowsWritten: dryRun ? 0 : writes.length, missingFoodCodes };
}
