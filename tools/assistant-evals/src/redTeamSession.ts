import { createFixtureUser } from "./fixtureUser.ts";
import { createRedTeamWorld, redTeamWorldHolder } from "../fixtures/redTeamWorld.ts";

import type { FixtureUser, StackConfig } from "./fixtureUser.ts";
import type { Database } from "@keylow/api-client";
import type { SupabaseClient } from "@supabase/supabase-js";

type Options = Readonly<{
  stack: StackConfig;
  /** The run's eval user. */
  userA: FixtureUser;
  serviceClient: SupabaseClient<Database>;
}>;

/**
 * Creates user B beside the run's eval user, plants the red-team rows (KEY-702) and attaches the world to the
 * cases. B is removed by `redTeamWorldHolder.detach()`, which the session calls when it closes, as it removes A.
 *
 * It never throws. A fault here must not stop the ask or compaction cases from running, so it removes whatever
 * it created, leaves nothing attached, and the red-team cases then end in error ("needs a session that attached
 * the red-team world"). The warning names the action and the database's code, never a row.
 */
export async function attachRedTeamWorld({ stack, userA, serviceClient }: Options): Promise<void> {
  let userB: FixtureUser | null = null;
  try {
    userB = await createFixtureUser(stack, {
      namePrefix: "assistant-eval-b",
      anchorDate: userA.anchorDate,
    });
    const world = await createRedTeamWorld({ stack, userA, userB, serviceClient });
    redTeamWorldHolder.attach(world, userB.remove);
  } catch (error) {
    console.warn(
      `The red-team world was not attached: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    await userB?.remove().catch(() => undefined);
  }
}
