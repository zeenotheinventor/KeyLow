// Writes the kitchen world (KEY-1028) as the eval user: the 47 earlier days of the palate window, the six kitchen
// recipes, the stated allergy and dislikes, and a programme with targets for each day of the week. It goes through
// the api-client repos the app writes with, so the snapshots and the cached nutrition are the app's own, and never
// a hand-written row. The one exception is the targets row: no client can write one, so the service role calls
// `record_targets`, as the check-in does.
//
// It only adds, and each part leaves alone what it finds, so a second call on one user adds nothing and another
// user's rows are never touched. Only a kitchen set asks for it (`src/kitchenWorld.ts`): `createFixtureUser` writes none of it.
import {
  addPalatePreference,
  createRecipe,
  listPalatePreferences,
  listRecipes,
  logEntries,
} from "@keylow/api-client";
import { addCalendarDays } from "@keylow/core/dates";
import { buildRecipeIngredient } from "@keylow/core/recipes";

import { diaryDateOf } from "./diary.ts";
import { KITCHEN_TARGETS, kitchenRecipes } from "./kitchen.ts";
import { PALATE_AVOID, earlierDays } from "./palate.ts";
import { present } from "./present.ts";

import type { FixtureFood } from "./diary.ts";
import type { PalateDay } from "./palate.ts";
import type { Database, LogEntriesItem, RecipeSummary } from "@keylow/api-client";
import type { Food } from "@keylow/core/schemas";
import type { SupabaseClient } from "@supabase/supabase-js";

type Client = SupabaseClient<Database>;
type Foods = ReadonlyMap<FixtureFood, Food>;

/** The six kitchen recipes not saved yet, made through `createRecipe` and found by name. */
export async function writeKitchenRecipes(client: Client, foods: Foods): Promise<void> {
  const stored = new Set((await listRecipes(client, { archived: true })).map(({ name }) => name));
  for (const { name, servings, yieldGrams, ingredients, steps } of kitchenRecipes) {
    if (stored.has(name)) {
      continue;
    }
    await createRecipe(client, {
      name,
      servings,
      yieldGrams,
      ingredients: ingredients.map(({ food, grams }) =>
        buildRecipeIngredient(present(foods.get(food), food), { quantity: grams, unit: "g" }),
      ),
      steps,
    });
  }
}

/** The local dates of the days that already have an entry, so a day is never written twice. */
async function datesWithEntries(
  client: Client,
  localDates: readonly string[],
): Promise<Set<string>> {
  const { data, error } = await client
    .from("food_log_entries")
    .select("local_date")
    .in("local_date", [...localDates])
    .is("deleted_at", null);
  if (error) {
    throw new Error(`Could not look up the days already written (${error.code})`);
  }
  return new Set(data.map(({ local_date }) => local_date));
}

function itemsOfDay(
  { dayNumber, entries }: PalateDay,
  anchorDate: string,
  foods: Foods,
  recipes: ReadonlyMap<string, RecipeSummary>,
): LogEntriesItem[] {
  const localDate = diaryDateOf(anchorDate, dayNumber);
  return entries.map(({ time, item }): LogEntriesItem => {
    const loggedAt = `${localDate}T${time}:00Z`;
    return item.kind === "food"
      ? {
          kind: "food",
          input: {
            food: present(foods.get(item.food), item.food),
            quantity: item.grams,
            unit: "g",
            loggedAt,
            localDate,
          },
        }
      : {
          kind: "recipe",
          input: {
            recipe: present(recipes.get(item.recipe), item.recipe),
            quantity: item.servings,
            unit: "serving",
            loggedAt,
            localDate,
          },
        };
  });
}

/**
 * The days before the 42 of the diary that are not written yet, so the diary fills the 90 day window of the palate.
 * The days of the diary itself are `createFixtureUser`'s. Entries only: no weigh-in, note or complete flag.
 */
export async function writeEarlierDays(
  client: Client,
  anchorDate: string,
  foods: Foods,
): Promise<void> {
  const days = earlierDays();
  const written = await datesWithEntries(
    client,
    days.map(({ dayNumber }) => diaryDateOf(anchorDate, dayNumber)),
  );
  const recipes = new Map(
    (await listRecipes(client, { archived: true })).map((recipe) => [recipe.name, recipe]),
  );
  await Promise.all(
    days
      .filter(({ dayNumber }) => !written.has(diaryDateOf(anchorDate, dayNumber)))
      .map((day) => logEntries(client, itemsOfDay(day, anchorDate, foods, recipes))),
  );
}

/** The allergy and the two dislikes not stored yet, each added once by its kind and word. */
export async function writePalateStatements(client: Client): Promise<void> {
  const stored = await listPalatePreferences(client);
  for (const statement of PALATE_AVOID) {
    const isStored = stored.some(
      ({ kind, label }) => kind === statement.kind && label?.toLowerCase() === statement.label,
    );
    if (!isStored) {
      await addPalatePreference(client, statement);
    }
  }
}

const PROGRAMME_ENGINE_VERSION = "keylow-engine-v1";
// The weekly check-in of the programme: a week from today, on the weekday the check-in tests use.
const CHECKIN_EVERY_DAYS = 7;
const CHECKIN_WEEKDAY = 4;

/**
 * An active programme and a current targets row with a figure for each day of the week (`KITCHEN_TARGETS`). The
 * programme is the user's own insert. The row is the service role's `record_targets`, the only writer. Both are
 * left alone when the user already has them. The basis day offsets stay zero by design: the day figures cannot sum to zero.
 */
export async function writeProgrammeTargets(
  client: Client,
  admin: Client,
  userId: string,
  anchorDate: string,
): Promise<void> {
  const startedOn = diaryDateOf(anchorDate, 0);
  const active = await client.from("programs").select("id").is("ended_on", null).maybeSingle();
  if (active.error) {
    throw new Error(`Could not look up the programme (${active.error.code})`);
  }
  let programId = active.data?.id;
  if (programId === undefined) {
    const inserted = await client
      .from("programs")
      .insert({
        goal: "lose",
        rate_pct_per_week: 0.5,
        protein_g_per_kg: 1.6,
        fat_fraction_of_remaining: 0.3,
        split_preset: "balanced",
        started_on: startedOn,
      })
      .select("id")
      .single();
    if (inserted.error) {
      throw new Error(`Could not start the programme (${inserted.error.code})`);
    }
    programId = inserted.data.id;
  }

  const current = await client
    .from("targets")
    .select("id")
    .eq("program_id", programId)
    .is("effective_to", null)
    .maybeSingle();
  if (current.error) {
    throw new Error(`Could not look up the targets (${current.error.code})`);
  }
  if (current.data !== null) {
    return;
  }
  const written = await admin.rpc("record_targets", {
    p_user_id: userId,
    p_targets: {
      program_id: programId,
      effective_from: startedOn,
      calories_kcal: KITCHEN_TARGETS.kcal,
      protein_g: KITCHEN_TARGETS.protein_g,
      fat_g: KITCHEN_TARGETS.fat_g,
      carbs_g: KITCHEN_TARGETS.carbs_g,
      dow_calories_kcal: [...KITCHEN_TARGETS.dowKcal],
      basis: {
        source: "start",
        tdeeKcal: 1857,
        trendWeightKg: 80,
        bmrKcal: 1700,
        goal: "lose",
        ratePctPerWeek: 0.5,
        effectiveRatePctPerWeek: 0.5,
        proteinGPerKg: 1.6,
        fatFraction: 0.3,
        dowOffsetsKcal: [0, 0, 0, 0, 0, 0, 0],
        clamps: [],
      },
      engine_version: PROGRAMME_ENGINE_VERSION,
      params: {},
    },
    p_start_snapshot: null,
    p_next_checkin_date: addCalendarDays(anchorDate, CHECKIN_EVERY_DAYS),
    p_checkin_weekday: CHECKIN_WEEKDAY,
  });
  if (written.error) {
    throw new Error(`Could not write the targets (${written.error.code})`);
  }
}
