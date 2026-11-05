import { describe, expect, it } from "vitest";

import { createUndoTurn } from "../src/undoTurn.ts";

import type { Database } from "@keylow/api-client";
import type { SupabaseClient } from "@supabase/supabase-js";

// The eval user's client is a fake that answers the one read of the turn's action ids, and the Undo call is the
// app's `undoAssistantActions`, replaced by a function that records the ids it was given.

/** The eval user's client, which answers the read of the turn's action ids and records what it was asked. */
function clientWithActions(ids: readonly string[], error: { code: string } | null = null) {
  const asked: string[] = [];
  const client = {
    from(table: string) {
      asked.push(`from ${table}`);
      return {
        select(columns: string) {
          asked.push(`select ${columns}`);
          return {
            eq(column: string, value: string) {
              asked.push(`eq ${column} ${value}`);
              return {
                order: (orderColumn: string) => {
                  asked.push(`order ${orderColumn}`);
                  return Promise.resolve({ data: ids.map((id) => ({ id })), error });
                },
              };
            },
          };
        },
      };
    },
    // The fake answers only the one read the undo makes, so it stands in for the whole client type.
  } as unknown as SupabaseClient<Database>;
  return { client, asked };
}

const FIRST = "11111111-1111-4111-8111-111111111111";
const SECOND = "22222222-2222-4222-8222-222222222222";

type Results = {
  actionId: string;
  result: "undone" | "already_undone" | "undo_unavailable" | "not_found";
}[];

function undoWith(ids: readonly string[], results: Results, error: { code: string } | null = null) {
  const { client, asked } = clientWithActions(ids, error);
  const undone: (readonly string[])[] = [];
  const undoTurn = createUndoTurn({
    client,
    undoActions: (_client, actionIds) => {
      undone.push(actionIds);
      return Promise.resolve(results);
    },
  });
  return { undoTurn, asked, undone };
}

describe("createUndoTurn", () => {
  it("should read the actions of the turn in the order they were written", async () => {
    const { undoTurn, asked } = undoWith([FIRST], [{ actionId: FIRST, result: "undone" }]);

    await undoTurn("turn-a");

    expect(asked).toEqual([
      "from assistant_actions",
      "select id",
      "eq turn_id turn-a",
      "order turn_seq",
    ]);
  });

  it("should give the action ids to the app's Undo and answer each outcome in the order written", async () => {
    const { undoTurn, undone } = undoWith(
      [FIRST, SECOND],
      [
        { actionId: SECOND, result: "undo_unavailable" },
        { actionId: FIRST, result: "undone" },
      ],
    );

    const outcomes = await undoTurn("turn-a");

    expect(outcomes).toEqual(["undone", "undo_unavailable"]);
    expect(undone).toEqual([[FIRST, SECOND]]);
  });

  it("should answer an empty list, and call nothing, for a turn that wrote nothing", async () => {
    const { undoTurn, undone } = undoWith([], []);

    expect(await undoTurn("turn-a")).toEqual([]);
    expect(undone).toEqual([]);
  });

  it("should fail with the database code when the actions cannot be read", async () => {
    const { undoTurn } = undoWith([], [], { code: "42501" });

    await expect(undoTurn("turn-a")).rejects.toThrow(
      "Could not read the actions of the turn (42501)",
    );
  });

  it("should fail when Undo leaves an action out of its answer", async () => {
    const { undoTurn } = undoWith([FIRST, SECOND], [{ actionId: FIRST, result: "undone" }]);

    await expect(undoTurn("turn-a")).rejects.toThrow("Undo answered for 1 of 2 actions");
  });
});
