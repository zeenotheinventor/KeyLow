import {
  getRecipe,
  listPalatePreferences,
  listRecipes,
  removePalatePreference,
  setNotUsual,
} from "@keylow/api-client";

import { seededFoods } from "./fixtureUser.ts";
import {
  writeEarlierDays,
  writeKitchenRecipes,
  writePalateStatements,
  writeProgrammeTargets,
} from "../fixtures/kitchenWrites.ts";

import type { FixtureUser } from "./fixtureUser.ts";
import type { FixtureFood } from "../fixtures/diary.ts";
import type { Database } from "@keylow/api-client";
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
