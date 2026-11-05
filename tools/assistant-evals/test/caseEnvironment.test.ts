import { describe, expect, it } from "vitest";

import { createCaseEnvironment } from "../src/caseEnvironment.ts";

import type { Database } from "@keylow/api-client";
import type { SupabaseClient } from "@supabase/supabase-js";

type Insert = { table: string; rows: Record<string, unknown>[] };

/**
 * A client that records inserts and answers the poll of `assistant_conversations` from a list, one answer
 * for each read, the last one repeating. It stands in for the service client of the run.
 */
function fakeClient(options: { notes?: (string | null)[]; failInsertOn?: string } = {}) {
  const inserts: Insert[] = [];
  const reads: Record<string, unknown>[] = [];
  const notes = [...(options.notes ?? [null])];
  const client = {
    from(table: string) {
      return {
        insert(rows: Record<string, unknown> | Record<string, unknown>[]) {
          const list = Array.isArray(rows) ? rows : [rows];
          inserts.push({ table, rows: list });
          const result = {
            data: list.map(() => ({ id: "new-conversation" })),
            error: options.failInsertOn === table ? { code: "42501" } : null,
          };
          return {
            select: () => ({ single: () => Promise.resolve({ ...result, data: result.data[0] }) }),
            then: (resolve: (value: typeof result) => unknown) => resolve(result),
          };
        },
        select(columns: string) {
          return {
            eq(column: string, value: unknown) {
              reads.push({ table, columns, column, value });
              return {
                maybeSingle: () =>
                  Promise.resolve({
                    data: { compaction_summary: notes.length > 1 ? notes.shift() : notes[0] },
                    error: null,
                  }),
              };
            },
          };
        },
      };
    },
    // The fake answers only the calls the environment makes, so it stands in for the whole client type.
  } as unknown as SupabaseClient<Database>;
  return { client, inserts, reads };
}

const userId = "11111111-1111-4111-8111-111111111111";

describe("seedConversation", () => {
  it("should store a conversation for the user with a complete turn and two messages for each seed turn", async () => {
    const { client, inserts } = fakeClient();
    const environment = createCaseEnvironment({ client, userId });

    const conversationId = await environment.seedConversation([
      { user: "first words", assistant: "first reply" },
      { user: "second words", assistant: "second reply" },
    ]);

    expect(conversationId).toBe("new-conversation");
    expect(inserts.map(({ table }) => table)).toEqual([
      "assistant_conversations",
      "assistant_turns",
      "assistant_messages",
    ]);
    expect(inserts[0]?.rows).toEqual([{ user_id: userId }]);
    const turns = inserts[1]?.rows ?? [];
    expect(turns).toHaveLength(2);
    for (const turn of turns) {
      expect(turn).toMatchObject({
        conversation_id: "new-conversation",
        user_id: userId,
        status: "complete",
      });
      expect(typeof turn["id"]).toBe("string");
      expect(typeof turn["user_message_id"]).toBe("string");
      expect(typeof turn["finished_at"]).toBe("string");
    }
  });

  it("should store the user message and then the reply of each turn in seq order, as text blocks", async () => {
    const { client, inserts } = fakeClient();

    await createCaseEnvironment({ client, userId }).seedConversation([
      { user: "first words", assistant: "first reply" },
      { user: "second words", assistant: "second reply" },
    ]);

    const turns = inserts[1]?.rows ?? [];
    const messages = inserts[2]?.rows ?? [];
    expect(messages.map((row) => [row["seq"], row["role"], row["content"]])).toEqual([
      [1, "user", [{ type: "text", text: "first words" }]],
      [2, "assistant", [{ type: "text", text: "first reply" }]],
      [3, "user", [{ type: "text", text: "second words" }]],
      [4, "assistant", [{ type: "text", text: "second reply" }]],
    ]);
    expect(messages.map((row) => row["turn_id"])).toEqual([
      turns[0]?.["id"],
      turns[0]?.["id"],
      turns[1]?.["id"],
      turns[1]?.["id"],
    ]);
    // The turn names the message that started it.
    expect(messages[0]?.["id"]).toBe(turns[0]?.["user_message_id"]);
    expect(messages[2]?.["id"]).toBe(turns[1]?.["user_message_id"]);
    expect(messages.every((row) => row["user_id"] === userId)).toBe(true);
    expect(messages.every((row) => row["conversation_id"] === "new-conversation")).toBe(true);
  });

  it("should fail with the code of a refused insert and never the rows", async () => {
    const { client } = fakeClient({ failInsertOn: "assistant_turns" });

    const failure = await createCaseEnvironment({ client, userId })
      .seedConversation([{ user: "secret words", assistant: "reply" }])
      .then(
        () => null,
        (error: unknown) => error,
      );

    const message = failure instanceof Error ? failure.message : "";
    expect(message).toContain("42501");
    expect(message).not.toContain("secret words");
  });
});

describe("waitForCompaction", () => {
  it("should resolve as soon as the conversation has a note", async () => {
    const { client, reads } = fakeClient({ notes: [null, null, "a note"] });
    const environment = createCaseEnvironment({
      client,
      userId,
      pollIntervalMilliseconds: 1,
      compactionTimeoutMilliseconds: 1_000,
    });

    await expect(environment.waitForCompaction("conversation-1")).resolves.toBeUndefined();

    expect(reads).toHaveLength(3);
    expect(reads[0]).toMatchObject({
      table: "assistant_conversations",
      column: "id",
      value: "conversation-1",
    });
  });

  it("should reject, naming the wait and not the note, when none is stored in time", async () => {
    const { client } = fakeClient({ notes: [null] });
    const environment = createCaseEnvironment({
      client,
      userId,
      pollIntervalMilliseconds: 1,
      compactionTimeoutMilliseconds: 20,
    });

    await expect(environment.waitForCompaction("conversation-1")).rejects.toThrow(
      "no compaction note was stored within 20 ms",
    );
  });
});

describe("undoActionsOfTurn", () => {
  const clientWithActions = (ids: readonly string[]): SupabaseClient<Database> =>
    ({
      from: () => ({
        select: () => ({
          eq: () => Promise.resolve({ data: ids.map((id) => ({ id })), error: null }),
        }),
      }),
      // The fake answers only the call the environment makes, so it stands in for the whole client type.
    }) as unknown as SupabaseClient<Database>;

  it("should undo every action of the turn through the app's Undo", async () => {
    const asked: (readonly string[])[] = [];
    const environment = createCaseEnvironment({
      client: clientWithActions(["action-1", "action-2"]),
      userId,
      undoActions: (ids) => {
        asked.push(ids);
        return Promise.resolve(ids.map(() => ({ result: "undone" })));
      },
    });

    await expect(environment.undoActionsOfTurn("turn-1")).resolves.toBeUndefined();
    expect(asked).toEqual([["action-1", "action-2"]]);
  });

  it("should reject when an action was not undone", async () => {
    const environment = createCaseEnvironment({
      client: clientWithActions(["action-1"]),
      userId,
      undoActions: () => Promise.resolve([{ result: "undo_unavailable" }]),
    });

    await expect(environment.undoActionsOfTurn("turn-1")).rejects.toThrow(
      "Undo did not answer undone",
    );
  });

  it("should reject when the turn has no action to undo", async () => {
    const environment = createCaseEnvironment({
      client: clientWithActions([]),
      userId,
      undoActions: () => Promise.resolve([]),
    });

    await expect(environment.undoActionsOfTurn("turn-1")).rejects.toThrow("no action to undo");
  });
});
