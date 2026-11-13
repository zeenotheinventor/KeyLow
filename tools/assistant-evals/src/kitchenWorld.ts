import {
  archiveMealPlan,
  confirmPlannedDay,
  deleteShoppingItem,
  getPlannedFoods,
  getRecipe,
  getShoppingSources,
  listMealPlans,
  listPalatePreferences,
  listRecipes,
  listShoppingItems,
  removePalatePreference,
  saveShoppingItems,
  setNotUsual,
  softDeleteLogEntry,
} from "@keylow/api-client";
import { planShoppingDraftsOf, planShoppingOf } from "@keylow/core/plans";
import { planListMerge } from "@keylow/core/shopping";

import { seededFoods } from "./fixtureUser.ts";
import {
  writeEarlierDays,
  writeKitchenRecipes,
  writePalateStatements,
  writeProgrammeTargets,
} from "../fixtures/kitchenWrites.ts";

import type { FixtureUser } from "./fixtureUser.ts";
import type { FixtureFood } from "../fixtures/diary.ts";
import type { Database, MealPlan } from "@keylow/api-client";
import type { PlanShoppingScope } from "@keylow/core/plans";
import type { ShoppingItem } from "@keylow/core/shopping";
import type { SupabaseClient } from "@supabase/supabase-js";

// What a kitchen set may ask of the eval user (KEY-1028): the palate world, six more recipes, the avoid list and a
// programme with a calorie figure for each day of the week. None of it is written when a session opens, because
// the other sets assert on the plain diary. A case that needs it calls `ensureWorld` from its `prepare`, once per
// session. The service role is the session's own and is used for the targets row only. The expected facts are
// worked out by core in `fixtures/palateProfile.ts` and `fixtures/kitchenFacts.ts`.
//
// The recipe and palate cases (KEY-1037) also read and change the world as the eval user, the way the app does:
// `recipesFingerprint` and `recipeIdOf` let a case prove that a turn left every recipe as it was, and `markNotUsual`
// and `clearCorrections` are the "not true" button of the Palate screen and its Undo.
//
// The meal plan cases (KEY-1038) press the Plan screen's buttons the same way, with the repos the app's hooks call:
// `confirmDay` is "Confirm day" (`useConfirmPlanDay`), `addPlanToList` is "Add to shopping list"
// (`useAddPlanToList`, whose hook is React Query and so is not called here), and `clearPlanning` puts the plans, the
// entries a confirmation wrote and the shopping list back, which a plan case needs because a plan is written to the
// diary and the list when its day is confirmed. The kitchen sets are the only users of the eval user's plans and list.

export type KitchenWorld = Readonly<{
  anchorDate: string;
  /** Writes the world once and does nothing after. Each part adds only what the user does not have. */
  ensureWorld: () => Promise<void>;
  /** The id of the user's recipe of this name, archived ones included. Rejects when there is none. */
  recipeIdOf: (name: string) => Promise<string>;
  /**
   * Every recipe of the user as stored, ordered by name and written as one string, so a recipe that was changed,
   * added or archived makes a different string. The user's own recipes only, read under row-level security.
   */
  recipesFingerprint: () => Promise<string>;
  /** Presses "not true" on a food of the profile, as the Palate screen does. */
  markNotUsual: (food: FixtureFood) => Promise<void>;
  /** Takes every "not true" correction back, as Undo does, and leaves the stated allergy and dislikes alone. */
  clearCorrections: () => Promise<void>;
  /** The user's live plans, as the Plan screen reads them: days in date order, items in position order. */
  livePlans: () => Promise<readonly MealPlan[]>;
  /** Presses "Confirm day" on a day of a live plan, as the Plan screen does, and answers the entry ids it wrote. */
  confirmDay: (dayId: string) => Promise<readonly string[]>;
  /** Presses "Add to shopping list" for the days of the live plans from `scope.start` to `scope.end`, staples left out. */
  addPlanToList: (scope: PlanShoppingScope) => Promise<void>;
  /** The shopping list as the app reads it. */
  shoppingList: () => Promise<readonly ShoppingItem[]>;
  /**
   * What core works out the list should hold for the scope, over the recipes and foods as they are now: the grams of
   * each food to buy, by food id. Read from the live plans, never from the list.
   */
  expectedShopping: (scope: PlanShoppingScope) => Promise<ReadonlyMap<string, number>>;
  /**
   * Removes the entries that confirming wrote, archives every live plan and empties the shopping list. Safe to
   * call when there is nothing to clear, and after a failure.
   */
  clearPlanning: () => Promise<void>;
}>;

export function createKitchenWorld(
  { client, id, anchorDate }: Pick<FixtureUser, "client" | "id" | "anchorDate">,
  serviceClient: SupabaseClient<Database>,
): KitchenWorld {
  let written: Promise<void> | null = null;

  const write = async (): Promise<void> => {
    const foods = await seededFoods(client);
    await writeKitchenRecipes(client, foods);
    await writeEarlierDays(client, anchorDate, foods);
    await writePalateStatements(client);
    await writeProgrammeTargets(client, serviceClient, id, anchorDate);
  };

  const recipeIdOf = async (name: string): Promise<string> => {
    const found = (await listRecipes(client, { archived: true })).find(
      (recipe) => recipe.name === name,
    );
    if (found === undefined) {
      throw new Error("The kitchen world has no recipe of the name a case asked for");
    }
    return found.id;
  };

  const timeZone = async (): Promise<string> => {
    const { data, error } = await client.from("profiles").select("timezone").maybeSingle();
    if (error) {
      throw new Error(`Could not read the eval user's time zone (${error.code})`);
    }
    return data?.timezone ?? "UTC";
  };

  const planShoppingSources = async (plans: readonly MealPlan[], scope: PlanShoppingScope) => {
    const shopping = planShoppingOf(plans, scope);
    if (shopping === null) {
      return null;
    }
    const [recipes, plannedFoods] = await Promise.all([
      getShoppingSources(client, shopping.recipeIds),
      getPlannedFoods(
        client,
        shopping.foods.map(({ foodId }) => foodId),
      ),
    ]);
    return planShoppingDraftsOf(shopping, recipes, plannedFoods);
  };

  return {
    anchorDate,
    ensureWorld: () => {
      written ??= write().catch((error: unknown) => {
        written = null;
        throw error;
      });
      return written;
    },
    recipeIdOf,
    recipesFingerprint: async () => {
      const summaries = (await listRecipes(client, { archived: true })).sort((left, right) =>
        left.name.localeCompare(right.name),
      );
      const details = await Promise.all(summaries.map(({ id }) => getRecipe(client, id)));
      return JSON.stringify(details);
    },
    markNotUsual: async (food) => {
      const found = (await seededFoods(client)).get(food);
      if (found === undefined) {
        throw new Error("The kitchen world has no seeded food of the kind a case asked for");
      }
      await setNotUsual(client, { foodId: found.id });
    },
    clearCorrections: async () => {
      const corrections = (await listPalatePreferences(client)).filter(
        ({ kind }) => kind === "not_usual",
      );
      for (const { id } of corrections) {
        await removePalatePreference(client, id);
      }
    },
    livePlans: () => listMealPlans(client),
    confirmDay: async (dayId) => {
      const day = (await listMealPlans(client))
        .flatMap(({ days }) => days)
        .find(({ id: candidate }) => candidate === dayId);
      if (day === undefined) {
        throw new Error("The user has no live plan day of the id a case asked to confirm");
      }
      return confirmPlannedDay(client, day, await timeZone());
    },
    addPlanToList: async (scope) => {
      const drafts = await planShoppingSources(await listMealPlans(client), scope);
      if (drafts === null) {
        return;
      }
      const { upserts } = planListMerge(await listShoppingItems(client), drafts.items);
      await saveShoppingItems(client, upserts);
    },
    shoppingList: () => listShoppingItems(client),
    expectedShopping: async (scope) => {
      const drafts = await planShoppingSources(await listMealPlans(client), scope);
      const grams = new Map<string, number>();
      for (const { foodId, grams: amount } of drafts?.items ?? []) {
        grams.set(foodId, (grams.get(foodId) ?? 0) + amount);
      }
      return grams;
    },
    clearPlanning: async () => {
      const plans = await listMealPlans(client);
      const written = plans.flatMap(({ days }) =>
        days.flatMap((day) => day.confirmedEntryIds ?? []),
      );
      for (const entryId of written) {
        await softDeleteLogEntry(client, entryId);
      }
      for (const { id: planId } of plans) {
        await archiveMealPlan(client, planId);
      }
      for (const { id: itemId } of await listShoppingItems(client)) {
        await deleteShoppingItem(client, itemId);
      }
    },
  };
}

// The kitchen world of a run, attached by the session when it opens and read by the kitchen cases, as the
// training world is. A case that runs with no session that attached one fails with a message that says so.
let attached: KitchenWorld | null = null;

export const kitchenWorldHolder = {
  attach: (world: KitchenWorld): void => {
    attached = world;
  },
  detach: (): Promise<void> => {
    attached = null;
    return Promise.resolve();
  },
  current: (): KitchenWorld => {
    if (attached === null) {
      throw new Error("The kitchen cases need a session that attached the kitchen world");
    }
    return attached;
  },
};
