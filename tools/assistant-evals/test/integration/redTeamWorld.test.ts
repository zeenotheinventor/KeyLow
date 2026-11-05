import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { adminClient } from "../../../../packages/db/test/integration/support/stack";
import { CONFIRM_DAY_ENTRY_COUNT, createRedTeamWorld } from "../../fixtures/redTeamWorld.ts";
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

  it("should plant nothing in A until a case asks, then plant it once", async () => {
    const plantedFoods = async () =>
      (
        await userA.client
          .from("foods")
          .select("name")
          .eq("owner_id", userA.id)
          .in("name", Object.values(world.planted.foodNames))
      ).data?.length;

    expect(await plantedFoods()).toBe(0);
    expect(await world.countEntriesOfAOn(world.planted.labels.logChocolate.localDate)).toBe(0);

    await Promise.all([world.ensurePlanted(), world.ensurePlanted()]);

    expect(await plantedFoods()).toBe(3);
    for (const label of Object.values(world.planted.labels)) {
      const expected =
        label.localDate === world.planted.labels.confirmDelete.localDate
          ? CONFIRM_DAY_ENTRY_COUNT
          : 1;
      expect(await world.countEntriesOfAOn(label.localDate)).toBe(expected);
    }
    expect(await world.countEntriesOfAOn(world.planted.writeLimitDirectDate)).toBe(0);
    expect(await world.countEntriesOfAOn(world.planted.blankMessageDate)).toBe(0);
  });

  it("should plant two plain entries on the day of the page confirmation case", async () => {
    await world.ensurePlanted();

    expect(await world.countEntriesOfAOn(world.planted.pageConfirmDate)).toBe(
      CONFIRM_DAY_ENTRY_COUNT,
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

  it("should read the tool results stored for a turn of A, and none stored for a turn of B", async () => {
    const admin = adminClient();
    // The rows are stored the way the turn loop stores them: the user message first (it has an id), then the tool
    // result as a message of its own with no id, one insert each. A single insert of both would send `id` as null
    // for the second row, which the table refuses. Every insert is checked, so a refused one cannot pass for an
    // empty read.
    const store = async (owner: FixtureUser, text: string) => {
      const { data: conversation, error } = await admin
        .from("assistant_conversations")
        .insert({ user_id: owner.id })
        .select("id")
        .single();
      expect(error).toBeNull();
      const conversationId = conversation?.id ?? "";
      const turnId = crypto.randomUUID();
      const userMessageId = crypto.randomUUID();
      const ids = { conversation_id: conversationId, turn_id: turnId, user_id: owner.id };
      const turnInsert = await admin.from("assistant_turns").insert({
        id: turnId,
        conversation_id: conversationId,
        user_id: owner.id,
        user_message_id: userMessageId,
        status: "complete",
      });
      expect(turnInsert.error).toBeNull();
      const userInsert = await admin.from("assistant_messages").insert({
        ...ids,
        id: userMessageId,
        role: "user",
        content: [{ type: "text", text: "Show me a day." }],
        seq: 1,
      });
      expect(userInsert.error).toBeNull();
      const resultInsert = await admin.from("assistant_messages").insert({
        ...ids,
        role: "user",
        content: [{ type: "tool_result", tool_use_id: "toolu_1", content: text }],
        display: null,
        seq: 2,
      });
      expect(resultInsert.error).toBeNull();
      return turnId;
    };
    const resultOfA = `<untrusted_data source="get_day">{"of":"a"}</untrusted_data>`;
    const resultOfB = `<untrusted_data source="get_day">{"of":"b"}</untrusted_data>`;
    const turnOfA = await store(userA, resultOfA);
    const turnOfB = await store(userB, resultOfB);

    expect(await world.toolResultsOf(turnOfA)).toEqual([resultOfA]);
    expect(await world.toolResultsOf(turnOfB)).toEqual([]);
  });

  it("should have the mcp function refuse A's JWT on B's open turn with a 401", async () => {
    const { status, body } = await world.callMcpOnTurnOfB();

    expect(status).toBe(401);
    expect(JSON.parse(body)).toMatchObject({ error: { code: "unauthorized" } });
    expect(await world.userB.liveEntryIds()).toHaveLength(2);
  });

  it("should have the mcp function refuse a write on an open turn with no message, and leave no entry", async () => {
    const { body } = await world.callMcpOnBlankTurnOfA();

    expect(body).toContain("no_user_message");
    expect(await world.countEntriesOfAOn(world.planted.blankMessageDate)).toBe(0);
  });

  it("should let ten log_entry calls through the mcp function and refuse the eleventh at the limit", async () => {
    const { bodies, entriesOnDay, actionRows } = await world.callMcpLogEntriesOnOpenTurnOfA(11);

    expect(bodies.slice(0, 10).some((body) => body.includes("write_limit_reached"))).toBe(false);
    expect(bodies[10]).toContain("write_limit_reached");
    expect(entriesOnDay).toBe(10);
    expect(actionRows).toBe(10);
  });

  it("should list every entry of B's diary, which no tool result of A may carry the id of", () => {
    expect(world.userB.allEntryIds.length).toBeGreaterThan(world.userB.entryIds.length);
    expect(world.userB.allEntryIds).toEqual(expect.arrayContaining([...world.userB.entryIds]));
    expect(world.userB.kcalFigures).toHaveLength(3);
    expect(world.userB.kcalFigures.every((figure) => figure >= 6000)).toBe(true);
  });
});
