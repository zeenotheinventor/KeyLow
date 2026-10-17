import {
  foodLogEntryInsertSchema,
  logEntryInsertSchema,
  quickLogEntryInsertSchema,
  recipeLogEntryInsertSchema,
} from "@keylow/core/diary";
import { nutrientsSchema } from "@keylow/core/schemas";
import { z } from "zod";

// The insert schemas of core already say what each column holds, so a row read back is parsed with
// the same shapes, plus the columns the database fills in. `safeExtend` keeps their refinements.
const databaseColumns = {
  id: z.guid(),
  created_at: z.iso.datetime({ offset: true }),
  kcal: z.number().nonnegative().nullable(),
};

/**
 * A live `food_log_entries` row as the diary reads it: a food, a quick add or a recipe entry. `user_id`
 * and `deleted_at` are not selected: the owner is the caller, and deleted rows are filtered out in the
 * query. `recipe_id` is selected and kept by the recipe member only, so the parse drops it from the
 * food and quick rows, which hold null.
 */
export const foodLogEntrySchema = foodLogEntryInsertSchema.safeExtend(databaseColumns);
export const quickLogEntrySchema = quickLogEntryInsertSchema.safeExtend(databaseColumns);
export const recipeLogEntrySchema = recipeLogEntryInsertSchema.safeExtend(databaseColumns);
export const logEntrySchema = z.discriminatedUnion("item_type", [
  foodLogEntrySchema,
  quickLogEntrySchema,
  recipeLogEntrySchema,
]);
export type LogEntry = z.infer<typeof logEntrySchema>;
export type FoodLogEntry = Extract<LogEntry, { item_type: "food" }>;
export type QuickLogEntry = Extract<LogEntry, { item_type: "quick" }>;
export type RecipeLogEntry = Extract<LogEntry, { item_type: "recipe" }>;

/** What the diary inserts: a food, a quick add or a recipe entry (a day copy writes all three). */
export const diaryInsertSchema = logEntryInsertSchema;
export type DiaryInsert = z.infer<typeof diaryInsertSchema>;

/** What `day_logs` says about a day. A day with no row is not complete. */
export const dayLogSchema = z.object({
  local_date: z.iso.date(),
  is_complete: z.boolean(),
  completed_at: z.iso.datetime({ offset: true }).nullable(),
  note: z.string().nullable(),
});
export type DayLog = z.infer<typeof dayLogSchema>;

/**
 * A `day_totals` row. Every nutrient is null when no live entry of the day gave a value for it
 * (never 0), and the view returns every key, so none is optional here.
 */
export const dayTotalsSchema = nutrientsSchema.required().extend({
  local_date: z.iso.date(),
  entry_count: z.number().int().nonnegative(),
});
export type DayTotals = z.infer<typeof dayTotalsSchema>;
