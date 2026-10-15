import { buildFoodSnapshot } from "./buildFoodSnapshot";
import { foodEntryFields } from "./foodEntryFields";
import { SNAPSHOT_VERSION } from "./versions";

import type { FoodLogEntryInsert, QuickLogEntryInsert } from "./schemas";
import type { QuantityUnit } from "../nutrition/units";
import type { Food, FoodPortion } from "../schemas/food";

type EntryTiming = {
  /** The instant the entry was logged, as an ISO 8601 timestamp with an offset. */
  loggedAt: string;
  /**
   * The calendar day the entry belongs to, `YYYY-MM-DD`, in the profile's time zone. The builders
   * store it as given and never derive it. Callers compute it from the instant and the profile's
   * zone with `toLocalDate(new Date(loggedAt), timeZone)` from `../dates`.
   */
  localDate: string;
};

export type BuildLogEntryInput = EntryTiming & {
  food: Food;
  quantity: number;
  unit: QuantityUnit;
  /** Read only when the unit is `portion`. Its id becomes the entry's `portion_id`. */
  portion?: Pick<FoodPortion, "id" | "label" | "grams" | "ml">;
};

export type BuildQuickEntryInput = EntryTiming & {
  kcal: number;
  protein_g?: number;
  fat_g?: number;
  carbs_g?: number;
  label?: string;
};

/**
 * Builds a food entry ready to insert: the frozen snapshot, the nutrients scaled from it, the
 * resolved grams, and the `portion_id` of the portion when the unit is `portion` (null otherwise, and null
 * for a spoon, which is not a database row).
 *
 * Throws a `RangeError` for a negative quantity or a `portion` unit without a valid portion.
 */
export const buildLogEntry = (input: BuildLogEntryInput): FoodLogEntryInsert => {
  const snapshot = buildFoodSnapshot(input.food, input);
  return {
    local_date: input.localDate,
    logged_at: input.loggedAt,
    ...foodEntryFields(snapshot, input.unit === "portion" ? (input.portion?.id ?? null) : null),
  };
};

/**
 * Builds a quick add: a calorie figure with optional macros and an optional label. A macro that was
 * not given is null (unknown, never 0). `food_log_entries` has no label column and the frozen
 * columns have no other free-text place, so the label lives in the `snapshot` jsonb, which a quick
 * entry otherwise has no use for. A blank label is stored as null.
 */
export const buildQuickEntry = (input: BuildQuickEntryInput): QuickLogEntryInsert => {
  const label = input.label?.trim();
  return {
    local_date: input.localDate,
    logged_at: input.loggedAt,
    item_type: "quick",
    food_id: null,
    quantity: null,
    unit: null,
    portion_id: null,
    resolved_grams: null,
    snapshot: {
      v: SNAPSHOT_VERSION,
      kind: "quick",
      label: label === undefined || label === "" ? null : label,
    },
    nutrients: {
      kcal: input.kcal,
      protein_g: input.protein_g ?? null,
      fat_g: input.fat_g ?? null,
      carbs_g: input.carbs_g ?? null,
      fibre_g: null,
    },
  };
};
