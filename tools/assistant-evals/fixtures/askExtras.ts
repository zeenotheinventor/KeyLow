// What the ask set (KEY-699) needs on top of the synthetic diary, without changing `diary.ts`: the targets
// the eval user is measured against. The diary writes none, and "what is left" and "days at target" need
// them. Calories are set just above the diary's usual day, so a few days reach it and most do not, and each
// macro is reached on some days and missed on others (the test checks that against the diary).
import { updateMyTargets } from "@keylow/api-client";

import type { FixtureUser } from "../src/fixtureUser.ts";
import type { ValidTargets } from "@keylow/core/diary";

export const ASK_TARGETS: ValidTargets = {
  kcal: 1300,
  protein_g: 90,
  carbs_g: 150,
  fat_g: 50,
};

/** Saves the ask targets as the eval user's own, the way the app's targets screen does. */
export async function writeAskExtras({ client, id }: Pick<FixtureUser, "client" | "id">) {
  await updateMyTargets(client, id, ASK_TARGETS);
}
