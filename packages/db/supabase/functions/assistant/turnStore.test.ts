import { assertEquals, assertRejects } from "@std/assert";

import { createTurnStore } from "./turnStore.ts";

import type { Database } from "../_shared/core/database.types.ts";
import type { SupabaseClient } from "@supabase/supabase-js";

const userId = "00000000-0000-4000-8000-0000000000a1";
const conversationId = "00000000-0000-4000-8000-0000000000c1";
const turnId = "00000000-0000-4000-8000-0000000000d3";

type Operation = {
  table: string;
  kind: "insert" | "update" | "select";
  values: Record<string, unknown> | null;
  filters: Record<string, unknown>;
};

// Records each query and answers it from the table and kind. A failing table and kind answers an error.
function fakeClient(failing: { table: string; kind: Operation["kind"] } | null = null) {
  const operations: Operation[] = [];
  const from = (table: string) => {
    const operation: Operation = { table, kind: "select", values: null, filters: {} };
    operations.push(operation);
    const answer = () => {
      if (failing?.table === table && failing.kind === operation.kind) {
        return { data: null, error: { code: "XX000" } };
      }
      const data =
        table === "assistant_turns" && operation.kind === "insert" ? { id: turnId } : null;
      return { data, error: null };
    };
    const builder = {
      insert(values: Record<string, unknown>) {
        operation.kind = "insert";
        operation.values = values;
        return builder;
      },
      update(values: Record<string, unknown>) {
        operation.kind = "update";
        operation.values = values;
        return builder;
      },
      select: () => builder,
      eq(column: string, value: unknown) {
        operation.filters[column] = value;
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      single: () => Promise.resolve(answer()),
      maybeSingle: () => Promise.resolve(answer()),
      then: (resolve: (value: ReturnType<typeof answer>) => unknown) => resolve(answer()),
    };
    return builder;
  };
  // The fake answers only the calls the turn store makes, so it stands in for the whole client type.
  const client = { from } as unknown as SupabaseClient<Database>;
  return { client, operations };
}

const input = { userId, conversationId, text: "two eggs on toast" };

Deno.test("startTurn stores the turn and the message, and bumps the conversation", async () => {
  const { client, operations } = fakeClient();

  const stored = await createTurnStore(client).startTurn(input);

  assertEquals(stored, turnId);
  const bump = operations.find((operation) => operation.table === "assistant_conversations");
  assertEquals(bump?.kind, "update");
  assertEquals(typeof bump?.values?.["updated_at"], "string");
  assertEquals(bump?.filters, { id: conversationId, user_id: userId });
});

Deno.test("startTurn fails the turn it inserted when the message insert fails", async () => {
  const { client, operations } = fakeClient({ table: "assistant_messages", kind: "insert" });

  await assertRejects(() => createTurnStore(client).startTurn(input));

  const failed = operations.find(
    (operation) => operation.table === "assistant_turns" && operation.kind === "update",
  );
  assertEquals(failed?.values?.["status"], "failed");
  assertEquals(typeof failed?.values?.["finished_at"], "string");
  assertEquals(failed?.filters, { id: turnId, user_id: userId });
});

Deno.test("startTurn fails the turn it inserted when the sequence read fails", async () => {
  const { client, operations } = fakeClient({ table: "assistant_messages", kind: "select" });

  await assertRejects(() => createTurnStore(client).startTurn(input));

  const failed = operations.find(
    (operation) => operation.table === "assistant_turns" && operation.kind === "update",
  );
  assertEquals(failed?.values?.["status"], "failed");
});

Deno.test("startTurn leaves no failed mark when the turn insert itself fails", async () => {
  const { client, operations } = fakeClient({ table: "assistant_turns", kind: "insert" });

  await assertRejects(() => createTurnStore(client).startTurn(input));

  assertEquals(
    operations.filter((operation) => operation.kind === "update"),
    [],
  );
});
