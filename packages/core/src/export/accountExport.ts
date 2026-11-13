import { z } from "zod";

/** The shape of the whole-account export. A change to it that an old reader would misread bumps this. */
export const ACCOUNT_EXPORT_VERSION = 1;

/**
 * Every table whose rows belong to the signed in user, in the order the export lists them. Shared
 * reference data, import plumbing and views are not here: the api-client coverage map says why for
 * each of them, and a new table fails its type check until someone decides.
 */
export const ACCOUNT_EXPORT_TABLES = [
  "profiles",
  "weigh_ins",
  "body_measurements",
  "food_log_entries",
  "day_logs",
  "foods",
  "food_portions",
  "food_favourites",
  "recipes",
  "recipe_ingredients",
  "recipe_favourites",
  "shopping_list_items",
  "programs",
  "expenditure_snapshots",
  "targets",
  "routines",
  "routine_days",
  "routine_exercises",
  "workout_sessions",
  "workout_sets",
  "training_goals",
  "accepted_suggestions",
  "exercises",
  "exercise_muscles",
  "assistant_conversations",
  "assistant_turns",
  "assistant_messages",
  "assistant_actions",
  "assistant_usage",
  "entitlements",
  "feature_requests",
  "palate_preferences",
  "meal_plans",
  "meal_plan_days",
  "meal_plan_items",
] as const;

export type AccountExportTable = (typeof ACCOUNT_EXPORT_TABLES)[number];

// A row as stored: every column under its own name, whatever the value. Nothing is derived or renamed.
const rowSchema = z.record(z.string(), z.json());
const rowsSchema = z.array(rowSchema);

const instantSchema = z.iso.datetime({ offset: true });

export const accountExportSchema = z.strictObject({
  export_version: z.literal(ACCOUNT_EXPORT_VERSION),
  exported_at: instantSchema,
  account: z.strictObject({
    id: z.guid(),
    email: z.string().nullable(),
    created_at: instantSchema,
    last_sign_in_at: instantSchema.nullable(),
    providers: z.array(z.string()),
  }),
  tables: z.strictObject({
    profiles: rowsSchema,
    weigh_ins: rowsSchema,
    body_measurements: rowsSchema,
    food_log_entries: rowsSchema,
    day_logs: rowsSchema,
    foods: rowsSchema,
    food_portions: rowsSchema,
    food_favourites: rowsSchema,
    recipes: rowsSchema,
    recipe_ingredients: rowsSchema,
    recipe_favourites: rowsSchema,
    shopping_list_items: rowsSchema,
    programs: rowsSchema,
    expenditure_snapshots: rowsSchema,
    targets: rowsSchema,
    routines: rowsSchema,
    routine_days: rowsSchema,
    routine_exercises: rowsSchema,
    workout_sessions: rowsSchema,
    workout_sets: rowsSchema,
    training_goals: rowsSchema,
    accepted_suggestions: rowsSchema,
    exercises: rowsSchema,
    exercise_muscles: rowsSchema,
    assistant_conversations: rowsSchema,
    assistant_turns: rowsSchema,
    assistant_messages: rowsSchema,
    assistant_actions: rowsSchema,
    assistant_usage: rowsSchema,
    entitlements: rowsSchema,
    feature_requests: rowsSchema,
    palate_preferences: rowsSchema,
    meal_plans: rowsSchema,
    meal_plan_days: rowsSchema,
    meal_plan_items: rowsSchema,
  }),
});

export type AccountExport = z.infer<typeof accountExportSchema>;
export type AccountExportRow = z.infer<typeof rowSchema>;

/** The file's text, indented with two spaces so a person can read it. */
export const serialiseAccountExport = (data: AccountExport): string =>
  JSON.stringify(data, null, 2);

/** `ki-lo-export-YYYY-MM-DD.json`, for the person's own local date. */
export const accountExportFileName = (localDate: string): string =>
  `ki-lo-export-${localDate}.json`;
