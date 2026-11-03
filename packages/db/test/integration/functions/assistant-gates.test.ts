import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { callAssistant, eventsOf, newAssistantUser, turnBody } from "../support/assistantClient";
import { requireServedFunction } from "../support/functionsLane";
import { adminClient } from "../support/stack";
import { deleteCreatedTestUsers } from "../support/users";

import type { AssistantResponse } from "../support/assistantClient";
import type { TestUser } from "../support/users";

/*
 * The `assistant` function's routes and access gates over HTTP, against the served function, with
 * real user JWTs and rows set with the service role. The kill switch and the monthly ceiling are not
 * here: the secret and the spend sum are global, so setting them would break the suites that run in
 * parallel. They are proved in the Deno tests (`assistant/gates.test.ts`), as is `plus`, because no
 * live user can lack the entitlement while the free plan is the default.
 *
 * A turn that passes the gates runs the turn loop against the Messages API mock, which answers one short
 * text reply when no script is registered, so a passing turn streams exactly `turn`, `text` and `done
 * complete`.
 * The suite assumes the run does not cross UTC midnight, because the daily turns come back then.
 */

const freeDailyTurns = 15;

function conversationIdFrom(response: AssistantResponse): string {
  const body: unknown = JSON.parse(response.text);
  if (
    typeof body === "object" &&
    body !== null &&
    "conversationId" in body &&
    typeof body.conversationId === "string"
  ) {
    return body.conversationId;
  }
  throw new Error("The conversations route answered without a conversation id");
}

const takeTurn = (user: TestUser) =>
  callAssistant("turn", { user, body: turnBody() }).then(eventsOf);

// The events of a turn that passed the gates and met the mock's default reply.
const passingTurn = [
  expect.objectContaining({ type: "turn" }),
  { type: "text", delta: "Noted." },
  { type: "done", outcome: "complete" },
];

const newUser = (options: { consented?: boolean } = {}) =>
  newAssistantUser("assistant-gates", options);

async function countTurns(user: TestUser): Promise<number> {
  const { count, error } = await adminClient()
    .from("assistant_turns")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (error) {
    throw new Error("Could not count the turns", { cause: error });
  }
  return count ?? 0;
}

// One hit against a bucket whose limit is 1 is allowed only when the bucket was empty.
async function bucketWasEmpty(user: TestUser): Promise<boolean> {
  const { data, error } = await adminClient()
    .rpc("consume_rate_limit", {
      p_bucket: `assistant:turns:${user.id}`,
      p_max: 1,
      p_window_seconds: 86_400,
    })
    .single();
  if (error) {
    throw new Error("Could not probe the bucket", { cause: error });
  }
  return data.allowed;
}

// A conversation, a turn and one action, all the user's own. Answers the action's id.
async function insertActionFor(user: TestUser): Promise<string> {
  const admin = adminClient();
  const conversation = await admin
    .from("assistant_conversations")
    .insert({ user_id: user.id })
    .select("id")
    .single();
  if (conversation.error) {
    throw new Error("Could not insert a conversation", { cause: conversation.error });
  }
  const turn = await admin
    .from("assistant_turns")
    .insert({
      conversation_id: conversation.data.id,
      user_id: user.id,
      user_message_id: crypto.randomUUID(),
    })
    .select("id")
    .single();
  if (turn.error) {
    throw new Error("Could not insert a turn", { cause: turn.error });
  }
  const action = await admin
    .from("assistant_actions")
    .insert({
      user_id: user.id,
      conversation_id: conversation.data.id,
      turn_id: turn.data.id,
      turn_seq: 1,
      tool: "log_entry",
      target_table: "food_log_entries",
      target_id: crypto.randomUUID(),
    })
    .select("id")
    .single();
  if (action.error) {
    throw new Error("Could not insert an action", { cause: action.error });
  }
  return action.data.id;
}

const secondsToUtcMidnight = () => {
  const now = new Date();
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return (midnight - now.getTime()) / 1000;
};

// The instant the day limit says the turns come back, in whole seconds.
const nextUtcMidnightInstant = () => {
  const now = new Date();
  const midnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  return midnight.toISOString().replace(".000Z", "Z");
};

beforeAll(async () => {
  await requireServedFunction(inject("stack"), "assistant");
  // A run of 16 turns must land in one UTC day.
  const wait = secondsToUtcMidnight();
  if (wait < 120) {
    await new Promise((resolve) => setTimeout(resolve, (wait + 2) * 1000));
  }
}, 150_000);

afterAll(async () => {
  await deleteCreatedTestUsers();
});

describe("sign-in and body", () => {
  it("answers 401 JSON to a call with no sign-in", async () => {
    const response = await callAssistant("turn", { body: turnBody() });

    expect(response.status).toBe(401);
    expect(JSON.parse(response.text)).toMatchObject({ error: { code: "unauthorized" } });
  });

  it("answers 400 JSON to a body that is not a turn", async () => {
    const user = await newUser();

    const response = await callAssistant("turn", { user, body: { text: "" } });

    expect(response.status).toBe(400);
    expect(JSON.parse(response.text)).toMatchObject({ error: { code: "invalid_request" } });
    expect(await countTurns(user)).toBe(0);
  });
});

describe("consent", () => {
  it("answers a consent_needed event and creates no turn", async () => {
    const user = await newUser({ consented: false });

    const response = await callAssistant("turn", { user, body: turnBody() });

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(eventsOf(response)).toEqual([
      { type: "notice", notice: { code: "consent_needed" } },
      { type: "done", outcome: "failed" },
    ]);
    expect(await countTurns(user)).toBe(0);
    expect(await bucketWasEmpty(user)).toBe(true);
  });

  it("answers consent_needed on status as JSON", async () => {
    const user = await newUser({ consented: false });

    const response = await callAssistant("status", { method: "GET", user });

    expect(response.status).toBe(200);
    expect(JSON.parse(response.text)).toEqual({ notice: { code: "consent_needed" } });
  });
});

describe("the daily turns of the free plan", () => {
  it("lets 15 turns through, gives the 16th the day limit, and status never spends", async () => {
    const user = await newUser();

    for (let turn = 1; turn < freeDailyTurns; turn += 1) {
      expect(await takeTurn(user)).toEqual(passingTurn);
    }
    // Looking costs nothing: three status calls, and the 15th turn is still allowed.
    for (let look = 0; look < 3; look += 1) {
      const status = await callAssistant("status", { method: "GET", user });
      expect(JSON.parse(status.text)).toEqual({ notice: null });
    }
    expect(await takeTurn(user)).toEqual(passingTurn);

    const dayLimit = { code: "day_limit", resetsAt: nextUtcMidnightInstant() };
    const afterFifteen = await callAssistant("status", { method: "GET", user });
    expect(JSON.parse(afterFifteen.text)).toEqual({ notice: dayLimit });
    const sixteenth = await takeTurn(user);
    expect(sixteenth).toEqual([
      { type: "notice", notice: dayLimit },
      { type: "done", outcome: "failed" },
    ]);
    // No turn row for the refused turn.
    expect(await countTurns(user)).toBe(freeDailyTurns);
    expect(await bucketWasEmpty(user)).toBe(false);
  }, 180_000);
});

describe("the unlimited plan", () => {
  it("takes 16 turns with no day limit and leaves no daily bucket", async () => {
    const user = await newUser();
    const { error } = await adminClient()
      .from("entitlements")
      .insert({ user_id: user.id, feature: "assistant", plan: "unlimited", source: "manual" });
    if (error) {
      throw new Error("Could not grant unlimited access", { cause: error });
    }

    for (let turn = 1; turn <= freeDailyTurns + 1; turn += 1) {
      expect(await takeTurn(user)).toEqual(passingTurn);
    }

    expect(await countTurns(user)).toBe(freeDailyTurns + 1);
    expect(await bucketWasEmpty(user)).toBe(true);
    const status = await callAssistant("status", { method: "GET", user });
    expect(JSON.parse(status.text)).toEqual({ notice: null });
  }, 180_000);
});

describe("conversations", () => {
  it("creates an empty conversation that only its owner can read", async () => {
    const alice = await newUser();
    const bob = await newUser();

    const response = await callAssistant("conversations", { user: alice });

    expect(response.status).toBe(200);
    const conversationId = conversationIdFrom(response);
    const own = await alice.client
      .from("assistant_conversations")
      .select("id, user_id")
      .eq("id", conversationId);
    const others = await bob.client
      .from("assistant_conversations")
      .select("id")
      .eq("id", conversationId);
    expect(own.data).toEqual([{ id: conversationId, user_id: alice.id }]);
    expect(others.data).toEqual([]);
  });

  it("fails a turn in a conversation that is not the caller's and starts none", async () => {
    const alice = await newUser();
    const bob = await newUser();
    const conversationId = conversationIdFrom(await callAssistant("conversations", { user: bob }));

    const response = await callAssistant("turn", {
      user: alice,
      body: { ...turnBody(), conversationId },
    });

    expect(eventsOf(response)).toEqual([
      { type: "notice", notice: { code: "turn_failed" } },
      { type: "done", outcome: "failed" },
    ]);
    expect(await countTurns(alice)).toBe(0);
  });
});

describe("undo", () => {
  it("tells the caller's own action from another user's, which is not_found", async () => {
    const alice = await newUser();
    const bob = await newUser();
    const own = await insertActionFor(alice);
    const others = await insertActionFor(bob);

    const response = await callAssistant("undo", {
      user: alice,
      body: { actionIds: [own, others] },
    });

    expect(response.status).toBe(200);
    // The registry has no inverse yet, so the caller's own action is found and cannot be undone. That is
    // the control: the other user's not_found comes from ownership, not from a missing tool.
    expect(JSON.parse(response.text)).toEqual({
      results: [
        { actionId: own, result: "undo_unavailable" },
        { actionId: others, result: "not_found" },
      ],
    });
    const after = await adminClient()
      .from("assistant_actions")
      .select("id, undone_at")
      .in("id", [own, others]);
    expect(after.data).toEqual(
      expect.arrayContaining([
        { id: own, undone_at: null },
        { id: others, undone_at: null },
      ]),
    );
  });
});
