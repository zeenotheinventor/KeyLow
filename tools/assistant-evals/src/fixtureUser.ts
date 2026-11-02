import { addWeighIn, createRecipe, getFood, logEntries, setDayComplete } from "@keylow/api-client";
import { buildRecipeIngredient } from "@keylow/core/recipes";
import { buildManualWeighIn } from "@keylow/core/weight";
import { createClient } from "@supabase/supabase-js";

import {
  DIARY_DAY_COUNT,
  FIXTURE_FOODS,
  FIXTURE_FOOD_CODES,
  diaryDateOf,
  diaryDay,
  fixtureRecipes,
  fixtureUserEmail,
} from "../fixtures/diary.ts";

import type { FixtureFood } from "../fixtures/diary.ts";
import type { Database, LogEntriesItem, RecipeDetail } from "@keylow/api-client";
import type { Food } from "@keylow/core/schemas";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Where the local stack is and the two keys it hands out. The caller reads them from the stack's own status. */
export type StackConfig = Readonly<{ apiUrl: string; anonKey: string; serviceRoleKey: string }>;

export type FixtureUserOptions = Readonly<{
  /** Starts the user's email. A test passes its own, so a stray user is easy to trace. */
  namePrefix?: string;
  /** The day after the last diary day, `YYYY-MM-DD`. Today (UTC) when left out. */
  anchorDate?: string;
}>;

export type FixtureUser = Readonly<{
  id: string;
  email: string;
  /** The day after the last diary day, `YYYY-MM-DD`. The diary runs for 42 days up to the day before it. */
  anchorDate: string;
  /** Signed in as the user, so every request carries the user's own JWT. */
  client: SupabaseClient<Database>;
  /** Deletes the user, and with it every row the diary wrote (they cascade). */
  remove: () => Promise<void>;
}>;

// Sessions are never persisted or refreshed, so each client is a self-contained caller.
const stateless = { auth: { persistSession: false, autoRefreshToken: false } };

const DEFAULT_NAME_PREFIX = "assistant-eval";
const WEIGH_IN_TIME = "07:00";

/** The seeded foods the diary uses, read as the user and keyed by name. */
async function seededFoods(client: SupabaseClient<Database>): Promise<Map<FixtureFood, Food>> {
  const { data, error } = await client
    .from("foods")
    .select("id,source_ref")
    .eq("source", "cofid")
    .is("owner_id", null)
    .in("source_ref", Object.values(FIXTURE_FOOD_CODES));
  if (error) {
    throw new Error(`Could not look up the seeded foods (${error.code})`);
  }

  const foods = new Map<FixtureFood, Food>();
  for (const name of FIXTURE_FOODS) {
    const code = FIXTURE_FOOD_CODES[name];
    const row = data.find(({ source_ref }) => source_ref === code);
    const found = row === undefined ? null : await getFood(client, row.id);
    if (found === null) {
      throw new Error(
        `The seeded food ${code} is missing, so the local stack needs its food seeds`,
      );
    }
    foods.set(name, found);
  }
  return foods;
}

const present = <Value>(value: Value | undefined, what: string): Value => {
  if (value === undefined) {
    throw new Error(`The fixture diary names ${what}, which it does not define`);
  }
  return value;
};

async function saveRecipes(
  client: SupabaseClient<Database>,
  foods: ReadonlyMap<FixtureFood, Food>,
): Promise<Map<string, RecipeDetail>> {
  const saved = new Map<string, RecipeDetail>();
  for (const { name, servings, yieldGrams, ingredients, steps } of fixtureRecipes) {
    const detail = await createRecipe(client, {
      name,
      servings,
      yieldGrams,
      ingredients: ingredients.map(({ food, grams }) =>
        buildRecipeIngredient(present(foods.get(food), food), { quantity: grams, unit: "g" }),
      ),
      steps,
    });
    saved.set(name, detail);
  }
  return saved;
}

async function writeDiaryDay(
  client: SupabaseClient<Database>,
  dayNumber: number,
  anchorDate: string,
  foods: ReadonlyMap<FixtureFood, Food>,
  recipes: ReadonlyMap<string, RecipeDetail>,
) {
  const localDate = diaryDateOf(anchorDate, dayNumber);
  const { entries, weightKg, complete, note } = diaryDay(dayNumber);
  const atUtc = (time: string) => `${localDate}T${time}:00Z`;

  const items: LogEntriesItem[] = entries.map(({ time, item }) =>
    item.kind === "food"
      ? {
          kind: "food",
          input: {
            food: present(foods.get(item.food), item.food),
            quantity: item.grams,
            unit: "g",
            loggedAt: atUtc(time),
            localDate,
          },
        }
      : {
          kind: "recipe",
          input: {
            recipe: present(recipes.get(item.recipe), item.recipe),
            quantity: item.servings,
            unit: "serving",
            loggedAt: atUtc(time),
            localDate,
          },
        },
  );
  await logEntries(client, items);

  if (weightKg !== null) {
    await addWeighIn(
      client,
      buildManualWeighIn({
        weightKg,
        measuredAt: new Date(atUtc(WEIGH_IN_TIME)),
        note: null,
        timeZone: "UTC",
      }),
    );
  }
  if (complete) {
    await setDayComplete(client, localDate, true);
  }
  if (note !== null) {
    // No repo writes a day's note yet, so this is the one plain update, through the user's own client.
    const { error } = await client.from("day_logs").update({ note }).eq("local_date", localDate);
    if (error) {
      throw new Error(`Could not write the day note (${error.code})`);
    }
  }
}

const LOCAL_HOSTNAMES: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Throws unless the stack is on this machine. The service role key can write anywhere in the stack it opens,
 * so the harness refuses to hold one for any stack that is not local. The message names neither the address
 * nor a key.
 */
export function assertLocalStack({ apiUrl }: StackConfig): void {
  let hostname: string | null = null;
  try {
    hostname = new URL(apiUrl).hostname;
  } catch {
    // An address that does not parse is not a local one.
  }
  if (hostname === null || !LOCAL_HOSTNAMES.has(hostname)) {
    throw new Error("The eval user is only created on a local stack (localhost, 127.0.0.1 or ::1)");
  }
}

/**
 * Creates a uniquely named user on the stack with the service role, signs in as them, and writes the
 * synthetic diary of `fixtures/diary.ts` through the api-client repos, so the snapshots and nutrients are
 * the ones the app writes. Two calls make two users that share no row. When the diary cannot be written the
 * user is removed again before the error is thrown. The stack must be a local one, and the service role key
 * is used here and nowhere else.
 */
export async function createFixtureUser(
  stack: StackConfig,
  {
    namePrefix = DEFAULT_NAME_PREFIX,
    anchorDate = new Date().toISOString().slice(0, 10),
  }: FixtureUserOptions = {},
): Promise<FixtureUser> {
  assertLocalStack(stack);
  const admin = createClient(stack.apiUrl, stack.serviceRoleKey, stateless);
  const email = fixtureUserEmail(namePrefix, crypto.randomUUID());
  const password = crypto.randomUUID();

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) {
    throw new Error(`Could not create the eval user (${createError.code ?? "unknown"})`);
  }
  const id = created.user.id;

  const remove = async () => {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) {
      throw new Error(`Could not delete the eval user (${error.code ?? "unknown"})`);
    }
  };

  try {
    const client = createClient<Database>(stack.apiUrl, stack.anonKey, stateless);
    const { error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) {
      throw new Error(`Could not sign in as the eval user (${signInError.code ?? "unknown"})`);
    }

    const foods = await seededFoods(client);
    const recipes = await saveRecipes(client, foods);
    await Promise.all(
      Array.from({ length: DIARY_DAY_COUNT }, (_, dayNumber) =>
        writeDiaryDay(client, dayNumber, anchorDate, foods, recipes),
      ),
    );
    return { id, email, anchorDate, client, remove };
  } catch (error) {
    await remove();
    throw error;
  }
}
