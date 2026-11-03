// Rows of the diary tables as the database returns them, for the diary read tools' tests. Nothing in
// production imports this.
export const idOf = (number: number) =>
  `00000000-0000-4000-8000-${String(number).padStart(12, "0")}`;

type NutrientValues = {
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  fibre_g: number | null;
};

export const noNutrients: NutrientValues = {
  kcal: null,
  protein_g: null,
  fat_g: null,
  carbs_g: null,
  fibre_g: null,
};

type EntryTiming = { number: number; localDate: string; loggedAt: string };

// A food entry logged as portions of a 120 g "1 medium" portion, with frozen nutrients that the food
// row below does not have, so a test can tell which of the two a sum came from.
export function portionEntryRow(
  { number, localDate, loggedAt }: EntryTiming,
  options: { name?: string; quantity?: number; nutrients?: NutrientValues } = {},
) {
  const quantity = options.quantity ?? 1;
  const nutrients = options.nutrients ?? {
    kcal: 96,
    protein_g: 1.2,
    fat_g: 0.3,
    carbs_g: 21.6,
    fibre_g: 3.1,
  };
  return {
    id: idOf(number),
    local_date: localDate,
    logged_at: loggedAt,
    created_at: loggedAt,
    item_type: "food",
    food_id: idOf(1000 + number),
    quantity,
    unit: "portion",
    portion_id: idOf(2000 + number),
    resolved_grams: 120 * quantity,
    snapshot: {
      v: 1,
      kind: "food",
      ref: idOf(1000 + number),
      name: options.name ?? "Banana",
      basis: "per_100g",
      per100: { ...nutrients, kcal: 80 },
      quantity,
      unit: "portion",
      portion: { label: "1 medium", grams: 120 },
      density: null,
      resolvedGrams: 120 * quantity,
      engineVersion: 1,
    },
    nutrients,
    kcal: nutrients.kcal,
    recipe_id: null,
  };
}

export function quickEntryRow(
  { number, localDate, loggedAt }: EntryTiming,
  options: { label?: string | null; nutrients?: NutrientValues } = {},
) {
  const nutrients = options.nutrients ?? { ...noNutrients, kcal: 250 };
  return {
    id: idOf(number),
    local_date: localDate,
    logged_at: loggedAt,
    created_at: loggedAt,
    item_type: "quick",
    food_id: null,
    quantity: null,
    unit: null,
    portion_id: null,
    resolved_grams: null,
    snapshot: { v: 1, kind: "quick", label: options.label ?? null },
    nutrients,
    kcal: nutrients.kcal,
    recipe_id: null,
  };
}

export function recipeEntryRow(
  { number, localDate, loggedAt }: EntryTiming,
  nutrients: NutrientValues,
) {
  return {
    id: idOf(number),
    local_date: localDate,
    logged_at: loggedAt,
    created_at: loggedAt,
    item_type: "recipe",
    food_id: null,
    recipe_id: idOf(3000 + number),
    quantity: 1,
    unit: "serving",
    portion_id: null,
    resolved_grams: 400,
    snapshot: {
      v: 1,
      kind: "recipe",
      ref: idOf(3000 + number),
      name: "Chilli",
      servings: 4,
      yieldGrams: 1600,
      effectiveGrams: 1600,
      total: { ...nutrients, kcal: 2000 },
      quantity: 1,
      unit: "serving",
      resolvedGrams: 400,
      engineVersion: 1,
    },
    nutrients,
    kcal: nutrients.kcal,
  };
}

export type DayTotalsValues = {
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
};

// A `day_totals` row: the view returns every key, and null says no entry gave a value for it.
export const dayTotalsRow = (localDate: string, entryCount: number, totals: DayTotalsValues) => ({
  local_date: localDate,
  entry_count: entryCount,
  ...totals,
  fibre_g: null,
  sat_fat_g: null,
  sugars_g: null,
  salt_g: null,
});

export const weighInRow = (
  number: number,
  localDate: string,
  weightKg: number,
  note: string | null = null,
) => ({
  id: idOf(4000 + number),
  measured_at: `${localDate}T07:30:00+00:00`,
  local_date: localDate,
  tz: "Europe/London",
  weight_kg: weightKg,
  source: "manual",
  note,
});

// The `profiles` row the tools read: the time zone and the manual targets.
export const profileRow = (
  overrides: { timezone?: string | null; target_kcal?: number | null } = {},
) => ({
  timezone: "Europe/London",
  target_kcal: 2200,
  target_protein_g: 140,
  target_carbs_g: 250,
  target_fat_g: 70,
  ...overrides,
});
