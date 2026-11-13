import type { Database } from "../database.types";

type PublicSchema = Database["public"];

/** `exported`, or the reason the table or view is left out of the whole-account export. */
type ExportClassification = "exported" | { notExported: string };

/**
 * Every table and view in the generated types, decided once. A migration that adds a table fails
 * `tsc` here until someone says whether it belongs in the export, and a unit test holds the
 * `exported` keys equal to core's `ACCOUNT_EXPORT_TABLES`.
 */
export const ACCOUNT_EXPORT_COVERAGE: Record<
  keyof PublicSchema["Tables"] | keyof PublicSchema["Views"],
  ExportClassification
> = {
  profiles: "exported",
  weigh_ins: "exported",
  body_measurements: "exported",
  food_log_entries: "exported",
  day_logs: "exported",
  foods: "exported",
  food_portions: "exported",
  food_favourites: "exported",
  recipes: "exported",
  recipe_ingredients: "exported",
  recipe_favourites: "exported",
  shopping_list_items: "exported",
  programs: "exported",
  expenditure_snapshots: "exported",
  targets: "exported",
  routines: "exported",
  routine_days: "exported",
  routine_exercises: "exported",
  workout_sessions: "exported",
  workout_sets: "exported",
  training_goals: "exported",
  accepted_suggestions: "exported",
  exercises: "exported",
  exercise_muscles: "exported",
  assistant_conversations: "exported",
  assistant_turns: "exported",
  assistant_messages: "exported",
  assistant_actions: "exported",
  assistant_usage: "exported",
  entitlements: "exported",
  feature_requests: "exported",
  palate_preferences: "exported",
  meal_plans: "exported",
  meal_plan_days: "exported",
  meal_plan_items: "exported",
  muscles: {
    notExported: "Shared reference data, the same for everyone. No row belongs to the account.",
  },
  food_source_data: {
    notExported: "Import plumbing with no grant for the app. Raw source records of shared foods.",
  },
  import_runs: { notExported: "Import plumbing with no grant for the app." },
  exercise_import_runs: { notExported: "Import plumbing with no grant for the app." },
  exercise_source_data: { notExported: "Import plumbing with no grant for the app." },
  exercise_form_videos: {
    notExported: "Shared reference data, the same for everyone. No row belongs to the account.",
  },
  rate_limits: { notExported: "Closed to every API role. Counters, not account data." },
  off_search_results: {
    notExported:
      "Closed to every API role. A shared cache of search results with no user id, not account data.",
  },
  day_totals: { notExported: "A view derived from the food log rows, which the export holds." },
  assistant_usage_daily: {
    notExported: "A view derived from the assistant usage rows, which the export holds.",
  },
  palate_logged_days: {
    notExported: "A view derived from the food log rows, which the export holds.",
  },
  palate_food_stats: {
    notExported: "A view derived from the food log rows, which the export holds.",
  },
};
