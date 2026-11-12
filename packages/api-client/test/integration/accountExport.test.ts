import { ACCOUNT_EXPORT_TABLES, accountExportSchema, serialiseAccountExport } from "@keylow/core";
import { buildLogEntry, buildQuickEntry } from "@keylow/core/diary";
import { buildRecipeIngredient, computeRecipe } from "@keylow/core/recipes";
import { customFoodInputSchema } from "@keylow/core/schemas";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { adminClient } from "./support/stack";
import { saveExercise, saveRoutine, startSession, logSets } from "./support/training";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { exportMyData, readMyDataByTable } from "../../src/repos/accountExport";
import { addFavouriteFood, addFavouriteRecipe } from "../../src/repos/favourites";
import { createFood } from "../../src/repos/foods";

import type { TestUser } from "./support/users";
import type { AccountExport, AccountExportTable } from "@keylow/core";
import type { Json } from "@keylow/db";

/*
 * The whole-account export against the real tables with two users. User A is a year of daily logging:
 * 1,001 weigh-ins and 1,460 food entries, so two tables need a second page, and a row in every exported
 * table. User B has a few rows in every table too, so a leak of either user's rows into the other's
 * export shows. Rows are written through each user's own client wherever a policy allows, and with the
 * service role for the tables only the server writes (targets and expenditure snapshots through
 * `record_targets`, the assistant tables, entitlements).
 *
 * Assertions look at row counts, ids and keys, never at values.
 */

const RUN_ID = crypto.randomUUID();
const YEAR_START = Date.UTC(2025, 10, 1);
const DAY = 24 * 60 * 60 * 1000;
const WEIGH_IN_COUNT = 1001;
const DAYS_LOGGED = 365;
const ENTRIES_PER_DAY = 4;

const dateOf = (dayIndex: number) =>
  new Date(YEAR_START + dayIndex * DAY).toISOString().slice(0, 10);
const instantOf = (dayIndex: number, hour: number) =>
  new Date(YEAR_START + dayIndex * DAY + hour * 60 * 60 * 1000).toISOString();

/** Throws with the code only, so a failed fixture write never prints a row. */
function succeeded(error: { code: string } | null, what: string): void {
  if (error !== null) {
    throw new Error(`Could not write the ${what} (${error.code})`);
  }
}

/** A chunked insert, because one request can only carry so much. */
async function insertInChunks<Row>(
  insert: (rows: Row[]) => PromiseLike<{ error: { code: string } | null }>,
  rows: Row[],
  what: string,
): Promise<void> {
  for (let from = 0; from < rows.length; from += 500) {
    succeeded((await insert(rows.slice(from, from + 500))).error, what);
  }
}

const customFood = (label: string) =>
  customFoodInputSchema.parse({
    name: `key707-${label}-${RUN_ID}`,
    basis: "per_100g",
    kcal: 250,
    protein_g: 10,
    fat_g: 8,
    carbs_g: 30,
    portions: [{ label: "1 portion", grams: 40, isDefault: true }],
  });

const ENGINE_VERSION = "keylow-engine-v1";

const targetsOf = (programId: string, effectiveFrom: string): Json => ({
  program_id: programId,
  effective_from: effectiveFrom,
  calories_kcal: 2150,
  protein_g: 126,
  fat_g: 73,
  carbs_g: 245,
  dow_calories_kcal: Array.from({ length: 7 }, () => 2150),
  basis: { source: "start" },
  engine_version: ENGINE_VERSION,
  params: {},
});

const measurementOf: Json = {
  eligible: true,
  zKcal: 2585,
  rKcal2: 62467.9,
  slopeKgPerDay: -0.05,
  seSlopeKg: 0.0198898,
  meanIntakeKcal: 2200,
  spanDays: 14,
  weighDays: 14,
  completeDays: 14,
  gain: 0.5,
  rawStepKcal: 312.5,
  stepKcal: 250,
  stepClamped: true,
};

const snapshotOf = (programId: string, asOfDate: string, measured: boolean): Json => ({
  program_id: programId,
  as_of_date: asOfDate,
  mu_kcal: 2200,
  var_kcal2: 90000,
  measurement: measured ? measurementOf : null,
  trend_weight_kg: measured ? 78.65 : null,
  engine_version: ENGINE_VERSION,
  params: {},
});

/** One row (or more) in every exported table for `user`, with `scale` times the usual number of logs. */
async function seed(user: TestUser, options: { year: boolean }): Promise<void> {
  const admin = adminClient();
  const client = user.client;

  // The profile row is made with the user.

  const foods = [
    (await createFood(client, user.id, customFood("a"))).food,
    (await createFood(client, user.id, customFood("b"))).food,
  ];
  const [food] = foods;
  if (food === undefined) {
    throw new Error("The fixture has a food");
  }
  succeeded((await client.from("food_favourites").insert({ food_id: food.id })).error, "favourite");

  const dayCount = options.year ? DAYS_LOGGED : 2;
  const perDay = options.year ? ENTRIES_PER_DAY : 1;
  const entries = Array.from({ length: dayCount }, (_, day) =>
    Array.from({ length: perDay }, (_, slot) =>
      slot === perDay - 1
        ? buildQuickEntry({
            kcal: 300,
            localDate: dateOf(day),
            loggedAt: instantOf(day, 8 + slot * 4),
            label: "Snack",
          })
        : buildLogEntry({
            food,
            quantity: 100 + slot,
            unit: "g",
            localDate: dateOf(day),
            loggedAt: instantOf(day, 8 + slot * 4),
          }),
    ),
  ).flat();
  await insertInChunks(
    (rows) => client.from("food_log_entries").insert(rows),
    entries,
    "food entries",
  );
  // One soft-deleted entry: the export holds it with its `deleted_at`.
  succeeded(
    (
      await client
        .from("food_log_entries")
        .update({ deleted_at: new Date().toISOString() })
        .eq("local_date", dateOf(0))
        .eq("item_type", "quick")
    ).error,
    "soft delete",
  );
  await insertInChunks(
    (rows) => client.from("day_logs").insert(rows),
    Array.from({ length: dayCount }, (_, day) => ({
      local_date: dateOf(day),
      is_complete: day % 2 === 0,
    })),
    "day logs",
  );

  const weighInCount = options.year ? WEIGH_IN_COUNT : 2;
  succeeded(
    (
      await client.from("weigh_ins").insert(
        Array.from({ length: weighInCount }, (_, day) => ({
          measured_at: instantOf(day, 7),
          local_date: dateOf(day),
          tz: "UTC",
          weight_kg: 70 + (day % 10) / 10,
          source: "manual" as const,
        })),
      )
    ).error,
    "weigh-ins",
  );
  succeeded(
    (
      await client
        .from("weigh_ins")
        .update({ deleted_at: new Date().toISOString() })
        .eq("local_date", dateOf(1))
    ).error,
    "soft delete",
  );
  succeeded(
    (
      await client.from("body_measurements").insert([
        {
          kind: "body_fat_pct" as const,
          measured_at: instantOf(0, 7),
          local_date: dateOf(0),
          tz: "UTC",
          value: 20,
          source: "manual" as const,
        },
        {
          kind: "lean_mass_kg" as const,
          measured_at: instantOf(0, 7),
          local_date: dateOf(0),
          tz: "UTC",
          value: 60,
          source: "manual" as const,
        },
      ])
    ).error,
    "body measurements",
  );

  const ingredients = foods.map((ingredientFood, position) => ({
    position,
    ...buildRecipeIngredient(ingredientFood, { quantity: 100 + position, unit: "g" }),
  }));
  const recipe = await client
    .from("recipes")
    .insert({
      owner_id: user.id,
      name: `key707-recipe-${RUN_ID}`,
      servings: 2,
      instructions: [],
      computed: computeRecipe({ servings: 2, yieldGrams: null, ingredients }),
    })
    .select("id")
    .single();
  succeeded(recipe.error, "recipe");
  const recipeId = recipe.data?.id ?? "";
  succeeded(
    (
      await client.from("recipe_ingredients").insert(
        ingredients.map((ingredient) => ({
          ...ingredient,
          recipe_id: recipeId,
          owner_id: user.id,
        })),
      )
    ).error,
    "recipe ingredients",
  );
  await addFavouriteRecipe(client, recipeId);
  succeeded(
    (await client.from("shopping_list_items").insert({ name: "Oats", position: 0 })).error,
    "shopping list",
  );

  const program = await client
    .from("programs")
    .insert({
      goal: "lose",
      rate_pct_per_week: 0.5,
      protein_g_per_kg: 1.6,
      fat_fraction_of_remaining: 0.3,
      split_preset: "balanced",
      started_on: "2026-10-01",
    })
    .select("id")
    .single();
  succeeded(program.error, "program");
  const programId = program.data?.id ?? "";
  succeeded(
    (
      await admin.rpc("record_targets", {
        p_user_id: user.id,
        p_targets: targetsOf(programId, "2026-10-01"),
        p_start_snapshot: snapshotOf(programId, "2026-10-01", false),
        p_next_checkin_date: "2026-10-15",
        p_checkin_weekday: 4,
      })
    ).error,
    "targets",
  );
  succeeded(
    (
      await admin.rpc("record_checkin", {
        p_user_id: user.id,
        p_snapshot: snapshotOf(programId, "2026-10-15", true),
        p_targets: targetsOf(programId, "2026-10-15"),
        p_next_checkin_date: "2026-11-06",
      })
    ).error,
    "check-in",
  );

  const exercise = await saveExercise(user, "export");
  const routineId = await saveRoutine(user, null, [
    { weekday: 1, name: "Push", exerciseIds: [exercise.id] },
  ]);
  const { data: days } = await client.from("routine_days").select("id").eq("routine_id", routineId);
  const sessionId = await startSession(user, dateOf(0));
  const setIds = await logSets(user, sessionId, exercise, [
    { performedAt: instantOf(0, 10) },
    { performedAt: instantOf(0, 11) },
  ]);
  succeeded(
    (
      await client
        .from("workout_sets")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", setIds[0] ?? "")
    ).error,
    "soft delete",
  );
  succeeded(
    (
      await client.from("training_goals").insert({
        goal: "aesthetic",
        days_per_week: 3,
        session_minutes: 60,
        experience: "beginner",
        muscle_priority: {},
        params_version: "key707",
      })
    ).error,
    "training goals",
  );
  succeeded(
    (
      await client.from("accepted_suggestions").insert({
        local_date: dateOf(0),
        routine_day_id: days?.[0]?.id ?? null,
        exercises: [{ exercise_id: exercise.id }],
        reasons: {},
        params_version: "key707",
      })
    ).error,
    "accepted suggestion",
  );

  // The assistant: a conversation with a turn and two messages, an action of it, an action whose
  // conversation was deleted, usage and an entitlement. The deleted conversation is removed with the
  // user's own client, as the app does, so the action's `conversation_id` becomes null.
  const conversation = await admin
    .from("assistant_conversations")
    .insert({ user_id: user.id })
    .select("id")
    .single();
  succeeded(conversation.error, "conversation");
  const conversationId = conversation.data?.id ?? "";
  const turn = await admin
    .from("assistant_turns")
    .insert({
      conversation_id: conversationId,
      user_id: user.id,
      user_message_id: crypto.randomUUID(),
      status: "complete",
    })
    .select("id")
    .single();
  succeeded(turn.error, "turn");
  const turnId = turn.data?.id ?? "";
  succeeded(
    (
      await admin.from("assistant_messages").insert(
        (["user", "assistant"] as const).map((role, index) => ({
          conversation_id: conversationId,
          turn_id: turnId,
          user_id: user.id,
          role,
          content: [{ type: "text", text: "key707" }],
          seq: index + 1,
        })),
      )
    ).error,
    "messages",
  );
  succeeded(
    (
      await admin.from("assistant_actions").insert({
        user_id: user.id,
        conversation_id: conversationId,
        turn_id: turnId,
        turn_seq: 1,
        tool: "log_entry",
        target_table: "food_log_entries",
        target_id: crypto.randomUUID(),
      })
    ).error,
    "action",
  );
  const doomed = await admin
    .from("assistant_conversations")
    .insert({ user_id: user.id })
    .select("id")
    .single();
  succeeded(doomed.error, "conversation");
  succeeded(
    (
      await admin.from("assistant_actions").insert({
        user_id: user.id,
        conversation_id: doomed.data?.id ?? "",
        turn_seq: 1,
        tool: "log_entry",
        target_table: "food_log_entries",
        target_id: crypto.randomUUID(),
      })
    ).error,
    "action",
  );
  succeeded(
    (
      await client
        .from("assistant_conversations")
        .delete()
        .eq("id", doomed.data?.id ?? "")
    ).error,
    "conversation delete",
  );
  succeeded(
    (
      await admin.from("assistant_usage").insert({
        user_id: user.id,
        turn_id: turnId,
        route: "describe_or_ask",
        model: "key707-model",
        input_tokens: 10,
        output_tokens: 5,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
        cost_usd_micros: 100,
        latency_ms: 50,
        transport: "none",
      })
    ).error,
    "usage",
  );
  succeeded(
    (
      await admin
        .from("entitlements")
        .insert({ user_id: user.id, feature: "assistant", plan: "plus", source: "manual" })
    ).error,
    "entitlement",
  );
  succeeded(
    (
      await client
        .from("feature_requests")
        .insert({ source: "more_menu", request: "key707 feature request" })
    ).error,
    "feature request",
  );
  await addFavouriteFood(client, (foods[1] ?? food).id);
}

/** The tables the service role may read. The rest are counted with the user's own client, which RLS scopes. */
const SERVICE_ROLE_READABLE: ReadonlySet<AccountExportTable> = new Set([
  "profiles",
  "day_logs",
  "foods",
  "food_portions",
  "food_log_entries",
  "weigh_ins",
  "programs",
  "expenditure_snapshots",
  "targets",
  "exercises",
  "exercise_muscles",
  "assistant_conversations",
  "assistant_turns",
  "assistant_messages",
  "assistant_actions",
]);

const OWNED_BY_OWNER_ID: ReadonlySet<AccountExportTable> = new Set([
  "foods",
  "food_portions",
  "food_favourites",
  "recipes",
  "recipe_ingredients",
  "recipe_favourites",
  "shopping_list_items",
  "exercises",
  "exercise_muscles",
]);

/** The column that holds the owner: the profile's own id, `owner_id` on the tables above, `user_id` elsewhere. */
const ownerColumnOf = (table: AccountExportTable) =>
  table === "profiles" ? "id" : OWNED_BY_OWNER_ID.has(table) ? "owner_id" : "user_id";

describe("the whole-account export against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;
  let exportOfA: AccountExport;
  let exportOfB: AccountExport;

  beforeAll(async () => {
    [userA, userB] = await Promise.all([createTestUser("key707"), createTestUser("key707")]);
    await seed(userA, { year: true });
    await seed(userB, { year: false });
    exportOfA = await exportMyData(userA.client);
    exportOfB = await exportMyData(userB.client);
  }, 120_000);

  afterAll(async () => {
    await deleteCreatedTestUsers();
  });

  it("should list every exported table with rows for both users", () => {
    for (const table of ACCOUNT_EXPORT_TABLES) {
      expect(exportOfA.tables[table].length, `A ${table}`).toBeGreaterThan(0);
      expect(exportOfB.tables[table].length, `B ${table}`).toBeGreaterThan(0);
    }
  });

  it("should hold the account block of the caller", () => {
    expect(exportOfA.account.id).toBe(userA.id);
    expect(exportOfA.account.email).toBe(userA.email);
    expect(exportOfA.account.providers).toEqual(["email"]);
    expect(exportOfB.account.id).toBe(userB.id);
  });

  it.each(ACCOUNT_EXPORT_TABLES)(
    "should hold as many %s rows for each user as the database counts for them",
    async (table) => {
      for (const [user, data] of [
        [userA, exportOfA],
        [userB, exportOfB],
      ] as const) {
        const reader = SERVICE_ROLE_READABLE.has(table) ? adminClient() : user.client;
        const { count, error } = await reader
          .from(table)
          .select("*", { count: "exact", head: true })
          .match({ [ownerColumnOf(table)]: user.id });

        expect(error).toBeNull();
        expect(data.tables[table]).toHaveLength(count ?? -1);
      }
    },
  );

  it("should hold no id or owner value of the other user in any table", () => {
    const idsOf = (data: AccountExport) =>
      Object.values(data.tables).flatMap((rows) =>
        rows.flatMap((row) => (typeof row.id === "string" ? [row.id] : [])),
      );

    const textOfA = JSON.stringify(exportOfA);
    const textOfB = JSON.stringify(exportOfB);

    expect(textOfA).not.toContain(userB.id);
    expect(textOfB).not.toContain(userA.id);
    expect(textOfA).not.toContain(userB.email);
    expect(textOfB).not.toContain(userA.email);
    expect(idsOf(exportOfB).filter((id) => textOfA.includes(id))).toEqual([]);
    expect(idsOf(exportOfA).filter((id) => textOfB.includes(id))).toEqual([]);
  });

  it("should hold the assistant tables, including an action whose conversation was deleted", () => {
    for (const table of [
      "assistant_conversations",
      "assistant_turns",
      "assistant_messages",
      "assistant_actions",
      "assistant_usage",
      "entitlements",
    ] as const) {
      expect(exportOfA.tables[table].length, table).toBeGreaterThan(0);
    }
    expect(
      exportOfA.tables.assistant_actions.filter((action) => action.conversation_id === null),
    ).toHaveLength(1);
  });

  it("should hold the user's own foods only, never a shared CoFID or Open Food Facts row", async () => {
    const shared = await adminClient()
      .from("foods")
      .select("*", { count: "exact", head: true })
      .is("owner_id", null);
    expect(shared.count ?? 0).toBeGreaterThan(0);

    for (const table of ["foods", "food_portions", "exercises", "exercise_muscles"] as const) {
      expect(
        exportOfA.tables[table].every((row) => row.owner_id === userA.id),
        table,
      ).toBe(true);
    }
    expect(exportOfA.tables.foods).toHaveLength(2);
    expect(exportOfA.tables.foods.every((food) => food.source === "user")).toBe(true);
  });

  it("should return a table of more than 1,000 rows whole", () => {
    const weighIns = exportOfA.tables.weigh_ins;

    expect(weighIns).toHaveLength(WEIGH_IN_COUNT);
    expect(new Set(weighIns.map((row) => row.id)).size).toBe(WEIGH_IN_COUNT);
    expect(exportOfA.tables.food_log_entries).toHaveLength(DAYS_LOGGED * ENTRIES_PER_DAY);
  });

  it("should hold the soft-deleted rows with their deleted_at", () => {
    for (const table of ["weigh_ins", "food_log_entries", "workout_sets"] as const) {
      const deleted = exportOfA.tables[table].filter((row) => typeof row.deleted_at === "string");

      expect(deleted.length, table).toBeGreaterThan(0);
    }
  });

  it("should hold the whole profile row with its consent columns", () => {
    const [profile] = exportOfA.tables.profiles;

    expect(profile).toHaveProperty("terms_accepted_at");
    expect(profile).toHaveProperty("assistant_consent_at");
    expect(profile).toHaveProperty("assistant_consent_version");
  });

  it("should round trip through serialisation and the schema", () => {
    const text = serialiseAccountExport(exportOfA);

    expect(accountExportSchema.parse(JSON.parse(text))).toEqual(exportOfA);
  });

  it("should read table by table the same rows the export holds", async () => {
    const seen: string[] = [];
    for await (const { table, rows } of readMyDataByTable(userB.client)) {
      seen.push(table);
      expect(rows).toHaveLength(exportOfB.tables[table].length);
    }

    expect(seen).toEqual([...ACCOUNT_EXPORT_TABLES]);
  });
});
