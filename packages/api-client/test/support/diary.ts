import { buildFoodSnapshot } from "@keylow/core/diary";
import { buildFood } from "@keylow/core/testing";

import type { DayLog, DayTotals, FoodLogEntry, QuickLogEntry } from "../../src/repos/diarySchemas";

export const FOOD_ID = "22222222-2222-4222-8222-222222222222";

const foodSnapshot = (name: string, quantity: number) =>
  buildFoodSnapshot(buildFood({ id: FOOD_ID, name, kcal: 200 }), { quantity, unit: "g" });

/** A food entry row as PostgREST returns it for the columns the diary reads. */
export const foodEntryRow = (overrides: Partial<FoodLogEntry> = {}): FoodLogEntry => ({
  id: "44444444-4444-4444-8444-444444444444",
  local_date: "2026-10-15",
  logged_at: "2026-10-15T08:30:00+00:00",
  created_at: "2026-10-15T08:31:00.123456+00:00",
  item_type: "food",
  food_id: FOOD_ID,
  quantity: 50,
  unit: "g",
  portion_id: null,
  resolved_grams: 50,
  snapshot: foodSnapshot("Rolled oats", 50),
  nutrients: { kcal: 100, protein_g: 4, fat_g: 2, carbs_g: 17, fibre_g: 3 },
  kcal: 100,
  ...overrides,
});

export const quickEntryRow = (overrides: Partial<QuickLogEntry> = {}): QuickLogEntry => ({
  id: "55555555-5555-4555-8555-555555555555",
  local_date: "2026-10-15",
  logged_at: "2026-10-15T12:00:00+00:00",
  created_at: "2026-10-15T12:01:00+00:00",
  item_type: "quick",
  food_id: null,
  quantity: null,
  unit: null,
  portion_id: null,
  resolved_grams: null,
  snapshot: { v: 1, kind: "quick", label: "Office cake" },
  nutrients: { kcal: 300, protein_g: null, fat_g: null, carbs_g: null, fibre_g: null },
  kcal: 300,
  ...overrides,
});

export const dayLogRow = (overrides: Partial<DayLog> = {}): DayLog => ({
  local_date: "2026-10-15",
  is_complete: true,
  completed_at: "2026-10-15T21:00:00+00:00",
  note: null,
  ...overrides,
});

export const dayTotalsRow = (overrides: Partial<DayTotals> = {}): DayTotals => ({
  local_date: "2026-10-15",
  entry_count: 2,
  kcal: 400,
  protein_g: 4,
  fat_g: 2,
  carbs_g: 17,
  fibre_g: 3,
  sat_fat_g: null,
  sugars_g: null,
  salt_g: null,
  ...overrides,
});
