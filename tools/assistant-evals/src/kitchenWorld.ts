import { seededFoods } from "./fixtureUser.ts";
import {
  writeEarlierDays,
  writeKitchenRecipes,
  writePalateStatements,
  writeProgrammeTargets,
} from "../fixtures/kitchenWrites.ts";

import type { FixtureUser } from "./fixtureUser.ts";
import type { Database } from "@keylow/api-client";
import type { SupabaseClient } from "@supabase/supabase-js";

// What a kitchen set may ask of the eval user (KEY-1028): the palate world, six more recipes, the avoid list and a
// programme with a calorie figure for each day of the week. None of it is written when a session opens, because
// the other sets assert on the plain diary. A case that needs it calls `ensureWorld` from its `prepare`, once per
// session. The service role is the session's own and is used for the targets row only. The expected facts are
// worked out by core in `fixtures/palateProfile.ts` and `fixtures/kitchenFacts.ts`.

export type KitchenWorld = Readonly<{
  anchorDate: string;
  /** Writes the world once and does nothing after. Each part adds only what the user does not have. */
  ensureWorld: () => Promise<void>;
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

  return {
    anchorDate,
    ensureWorld: () => {
      written ??= write().catch((error: unknown) => {
        written = null;
        throw error;
      });
      return written;
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
