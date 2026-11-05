import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { adminClient } from "../../../../packages/db/test/integration/support/stack";
import { createRedTeamWorld } from "../../fixtures/redTeamWorld.ts";
import { createFixtureUser } from "../../src/fixtureUser.ts";

import type { RedTeamWorld } from "../../fixtures/redTeamWorld.ts";
import type { FixtureUser } from "../../src/fixtureUser.ts";

// The red-team world (KEY-702) against the local stack: the planted rows, the isolation of A and B, and the two
// direct calls to the served `mcp` function. These users are new for the run, named key702-<run id>-..., and
// afterAll removes them. No model is called.
const namePrefix = `key702-${crypto.randomUUID().slice(0, 8)}`;

const created: FixtureUser[] = [];
let userA: FixtureUser;
let userB: FixtureUser;
let world: RedTeamWorld;

beforeAll(async () => {
  const stack = inject("stack");
  userA = await createFixtureUser(stack, { namePrefix: `${namePrefix}-a` });
  created.push(userA);
  userB = await createFixtureUser(stack, { namePrefix: `${namePrefix}-b` });
  created.push(userB);
  world = await createRedTeamWorld({ stack, userA, userB, serviceClient: adminClient() });
}, 120_000);

afterAll(async () => {
  await Promise.all(created.map((user) => user.remove().catch(() => undefined)));
});

describe("the red-team world against the local stack", () => {
  it("should give B two entries on a day of its own, and none of A's tools can see them", async () => {
    expect(await world.userB.liveEntryIds()).toHaveLength(2);

    const { count, error } = await userA.client
      .from("food_log_entries")
      .select("*", { count: "exact", head: true })
      .eq("local_date", world.userB.localDate);

    expect(error).toBeNull();
    expect(count).toBe(0);
  });

  it("should keep B's marker texts out of everything A can read", async () => {
    const { data, error } = await userA.client
      .from("food_log_entries")
      .select("snapshot")
      .or(world.userB.markers.map((marker) => `snapshot->>label.eq.${marker}`).join(","));

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("should plant one entry on each of A's label days and none on the write-cap and blank-message days", async () => {
    for (const { localDate } of Object.values(world.planted.labels)) {
      expect(await world.countEntriesOfAOn(localDate)).toBe(1);
    }
    expect(await world.countEntriesOfAOn(world.planted.writeCapDate)).toBe(0);
    expect(await world.countEntriesOfAOn(world.planted.blankMessageDate)).toBe(0);
  });

  it("should plant A's three foods, which A can find by name", async () => {
    const { data, error } = await userA.client
      .from("foods")
      .select("name")
      .eq("owner_id", userA.id)
      .in("name", Object.values(world.planted.foodNames));

    expect(error).toBeNull();
    expect(data?.map(({ name }) => name).sort()).toEqual(
      Object.values(world.planted.foodNames).sort(),
    );
  });

  it("should plant nothing in A's diary window, so no other set can see it", async () => {
    const earliestDiaryDay = new Date(`${world.anchorDate}T00:00:00Z`);
    earliestDiaryDay.setUTCDate(earliestDiaryDay.getUTCDate() - 42);
    const { data, error } = await userA.client
      .from("food_log_entries")
      .select("local_date,snapshot")
      .gte("local_date", earliestDiaryDay.toISOString().slice(0, 10));

    expect(error).toBeNull();
    expect(JSON.stringify(data)).not.toContain("ADMIN OVERRIDE");
  });

  it("should record the tool results of a turn of A and none of B's", async () => {
    expect(await world.toolResultsOf(crypto.randomUUID())).toEqual([]);
  });

  it("should have the mcp function refuse A's JWT on B's open turn with a 401", async () => {
    const { status } = await world.callMcpOnTurnOfB();

    expect(status).toBe(401);
    expect(await world.userB.liveEntryIds()).toHaveLength(2);
  });

  it("should have the mcp function refuse a write on an open turn with no message, and leave no entry", async () => {
    const { body } = await world.callMcpOnBlankTurnOfA();

    expect(body).toContain("no_user_message");
    expect(await world.countEntriesOfAOn(world.planted.blankMessageDate)).toBe(0);
  });
});
