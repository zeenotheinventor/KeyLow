import { assert, assertEquals, assertFalse, assertObjectMatch } from "@std/assert";

import { executeTool } from "../executor.ts";
import {
  createFakeActionStore,
  createFakeContext,
  turnsOfConversation,
  userId,
} from "../testing.ts";
import { undoAction } from "../undo.ts";
import { copyDayTool } from "./copyDay.ts";
import { quickEntryRow } from "./diaryFixtures.ts";
import { payloadOf } from "./testing.ts";
import { dietRows, structuredOf } from "./writeFixtures.ts";
import { writeStub } from "./writeStub.ts";

import type { ReportedFailure } from "../testing.ts";
import type { ToolContext } from "../tool.ts";

const earlier = "00000000-0000-4000-8000-0000000000d1";
const later = "00000000-0000-4000-8000-0000000000d2";
const otherUser = "00000000-0000-4000-8000-0000000000b2";
const yesterday = "2026-11-02";
const today = "2026-11-03";

const labels = ["Porridge", "Sandwich", "Chicken and rice"];
const kcals = [300, 450, 650];

// Yesterday's meals at 08:00, 13:00 and 19:00. Hers are another user's and must never be read or copied.
const mealsOf = (owner: string, localDate: string, count = labels.length) =>
  Array.from({ length: count }, (_, index) => ({
    ...quickEntryRow(
      {
        number: owner === userId ? 100 + index : 900 + index,
        localDate,
        loggedAt: `${localDate}T${String(8 + index).padStart(2, "0")}:00:00.000Z`,
      },
      {
        label: labels[index % labels.length] ?? "Meal",
        nutrients: {
          kcal: kcals[index % kcals.length] ?? 100,
          protein_g: null,
          fat_g: null,
          carbs_g: null,
          fibre_g: null,
        },
      },
    ),
    user_id: owner,
    deleted_at: null,
    updated_at: "2026-11-02T20:00:00.000000+00:00",
  }));

type Diary = Record<string, Record<string, unknown>[]>;

// The earlier turn is where the model asks and the later one where the user has said yes.
function copyContexts(rows: Diary, options: { slotLimit?: number } = {}) {
  const stub = writeStub({ ...dietRows(), ...rows }, { callerUserId: userId });
  const store = createFakeActionStore({
    turns: turnsOfConversation([earlier, later]),
    ...(options.slotLimit === undefined ? {} : { slotLimit: options.slotLimit }),
  });
  const reported: ReportedFailure[] = [];
  const contextOn = (turnId: string): ToolContext => {
    const made = createFakeContext([copyDayTool], {
      store,
      turn: { id: turnId, conversationId: store.turns[0]?.conversationId ?? "" },
      localDate: today,
      localTime: "13:00",
    });
    return {
      ...made.ctx,
      caller: stub.caller,
      reportError: (functionName, code, caught) => {
        reported.push({ functionName, code, caught });
      },
    };
  };
  return { stub, store, asking: contextOn(earlier), confirming: contextOn(later), reported };
}

const mine = (stub: ReturnType<typeof writeStub>, localDate: string) =>
  (stub.tables["food_log_entries"] ?? []).filter(
    (row) =>
      row["user_id"] === userId && row["local_date"] === localDate && row["deleted_at"] === null,
  );

const copyOf = (entryCount: number, to: string | null = null) => ({
  from: yesterday,
  to,
  entry_count: entryCount,
});

Deno.test("a copy onto an empty day writes at once and builds the board's card", async () => {
  const { asking, stub, store } = copyContexts({
    food_log_entries: mealsOf(userId, yesterday),
  });

  const result = await executeTool(asking, "copy_day", copyOf(3));

  assertEquals(result.status, "ok");
  assertObjectMatch(structuredOf(result), {
    card: {
      kind: "day_copied",
      title: "Copied 3 entries from yesterday",
      sub: "Monday 2 November to today · 1,400 kcal",
      rows: [],
      undo: "available",
      undoneSub: "Removed 3 copied entries from today",
    },
  });
  const copies = mine(stub, today);
  assertEquals(copies.length, 3);
  assertEquals(mine(stub, yesterday).length, 3);
  assertEquals(
    copies.map((row) => row["logged_at"]),
    mealsOf(userId, yesterday).map((row) => String(row.logged_at).replace(yesterday, today)),
  );
  assertEquals(store.actions.length, 1);
  const [action] = store.actions;
  assertEquals(action?.tool, "copy_day");
  assertEquals(action?.targetTable, "food_log_entries");
  assertEquals(action?.targetId, null);
  assertEquals(
    [...(action?.targetIds ?? [])].sort(),
    copies.map((row) => String(row["id"])).sort(),
  );
  assertEquals(action?.targetLocalDate, today);
  assertEquals(action?.targetUpdatedAt, copies[0]?.["updated_at"]);
  assert(copies.every((row) => row["updated_at"] === action?.targetUpdatedAt));
});

Deno.test(
  "a copy onto another day names it and defaults to the turn's day only when to is null",
  async () => {
    const { asking, stub } = copyContexts({ food_log_entries: mealsOf(userId, yesterday) });

    const result = await executeTool(asking, "copy_day", copyOf(3, "2026-11-01"));

    assertEquals(result.status, "ok");
    assertEquals(mine(stub, "2026-11-01").length, 3);
    assertEquals(mine(stub, today).length, 0);
    assertObjectMatch(structuredOf(result), {
      card: { sub: "Monday 2 November to Sunday 1 November · 1,400 kcal" },
    });
  },
);

Deno.test(
  "a copy onto a day with 3 entries answers needs_confirmation, and with the spent confirmation copies and keeps the 3",
  async () => {
    const { asking, confirming, stub, store } = copyContexts({
      food_log_entries: [
        ...mealsOf(userId, yesterday, 3),
        ...mealsOf(userId, today, 3).map((row, index) => ({
          ...row,
          id: `00000000-0000-4000-8000-0000000e000${index}`,
        })),
      ],
    });
    const before = mine(stub, today).map((row) => String(row["id"]));

    const asked = await executeTool(asking, "copy_day", copyOf(3));

    assert(asked.status === "needs_confirmation");
    assertEquals(Object.keys(payloadOf(asked) as object).sort(), ["confirmation_id", "status"]);
    assertEquals(mine(stub, today).length, 3);
    assertEquals(store.actions.length, 0);

    const copied = await executeTool(confirming, "copy_day", {
      ...copyOf(3),
      confirmation_id: asked.confirmationId,
    });

    assertEquals(copied.status, "ok");
    const onToday = mine(stub, today);
    assertEquals(onToday.length, 6);
    assert(before.every((id) => onToday.some((row) => row["id"] === id)));
    assertEquals(store.actions.filter((action) => action.tool === "copy_day").length, 1);
  },
);

Deno.test(
  "a confirmation given for a different copy is refused and nothing is copied",
  async () => {
    const { asking, confirming, stub } = copyContexts({
      food_log_entries: [...mealsOf(userId, yesterday), ...mealsOf(userId, today, 1)],
    });
    const asked = await executeTool(asking, "copy_day", copyOf(3));
    assert(asked.status === "needs_confirmation");

    const result = await executeTool(confirming, "copy_day", {
      from: "2026-11-01",
      to: null,
      entry_count: 3,
      confirmation_id: asked.confirmationId,
    });

    assertEquals(result.status, "error");
    assertEquals(mine(stub, today).length, 1);
  },
);

Deno.test("undo removes exactly the copied rows and leaves the rest of the day", async () => {
  const { asking, stub } = copyContexts({
    food_log_entries: mealsOf(userId, yesterday),
  });
  const copied = await executeTool(asking, "copy_day", copyOf(3));
  assert(copied.status === "ok" && copied.actionId !== null);
  // Added to the day after the copy: it is not one of the copied rows.
  await stub.caller.from("food_log_entries").insert({
    ...mealsOf(userId, today, 1)[0],
    id: "00000000-0000-4000-8000-0000000e0999",
  } as never);

  const result = await undoAction(asking, copied.actionId);

  assertEquals(result, { status: "undone", actionId: copied.actionId });
  assertEquals(
    mine(stub, today).map((row) => row["id"]),
    ["00000000-0000-4000-8000-0000000e0999"],
  );
  assertEquals(mine(stub, yesterday).length, 3);
});

Deno.test("undo is unavailable once the person changed or removed one of the copies", async () => {
  const { asking, stub } = copyContexts({ food_log_entries: mealsOf(userId, yesterday) });
  const copied = await executeTool(asking, "copy_day", copyOf(3));
  assert(copied.status === "ok" && copied.actionId !== null);
  const [first] = mine(stub, today);
  await stub.caller
    .from("food_log_entries")
    .update({ deleted_at: "2026-11-03T09:30:00.000Z" })
    .eq("id", String(first?.["id"]));

  const result = await undoAction(asking, copied.actionId);

  assertEquals(result, { status: "error", code: "undo_unavailable" });
  assertEquals(mine(stub, today).length, 2);
});

Deno.test("a 12-entry copy takes one slot and writes all twelve", async () => {
  const { asking, stub, store } = copyContexts(
    { food_log_entries: mealsOf(userId, yesterday, 12) },
    { slotLimit: 3 },
  );

  const result = await executeTool(asking, "copy_day", copyOf(12));

  assertEquals(result.status, "ok");
  assertEquals(mine(stub, today).length, 12);
  assertEquals(
    store.actions.map((action) => action.turnSeq),
    [1],
  );
});

Deno.test("a copy on a turn with no slot left writes nothing", async () => {
  const { asking, stub, store } = copyContexts(
    { food_log_entries: mealsOf(userId, yesterday, 12) },
    { slotLimit: 1 },
  );
  await executeTool(asking, "copy_day", copyOf(12, "2026-11-01"));

  const result = await executeTool(asking, "copy_day", copyOf(12));

  assertEquals(result.status, "error");
  assertEquals(payloadOf(result), { error: "write_limit_reached" });
  assertEquals(mine(stub, today).length, 0);
  assertEquals(store.actions.length, 1);
});

Deno.test("a copy changes only the caller's day, and the action rows hold ids only", async () => {
  const { asking, stub, store } = copyContexts({
    food_log_entries: [...mealsOf(userId, yesterday), ...mealsOf(otherUser, yesterday)],
  });

  const result = await executeTool(asking, "copy_day", copyOf(3));

  assertEquals(result.status, "ok");
  const hers = (stub.tables["food_log_entries"] ?? []).filter(
    (row) => row["user_id"] === otherUser,
  );
  assertEquals(hers.length, 3);
  assert(hers.every((row) => row["local_date"] === yesterday && row["deleted_at"] === null));
  const written = JSON.stringify(store.actions);
  for (const word of [...labels, "kcal", "Hers"]) {
    assertFalse(written.includes(word));
  }
});

Deno.test("the number of entries must be the day's, or nothing is copied", async () => {
  const { asking, stub, store } = copyContexts({ food_log_entries: mealsOf(userId, yesterday) });

  const result = await executeTool(asking, "copy_day", copyOf(8));

  assertEquals(payloadOf(result), { error: "invalid_input", fields: ["entry_count"] });
  assertEquals(mine(stub, today).length, 0);
  assertEquals(store.actions.length, 0);
});

Deno.test(
  "a day cannot be copied onto itself, and a day with nothing on it is not copied",
  async () => {
    const { asking, stub, store } = copyContexts({ food_log_entries: mealsOf(userId, yesterday) });

    const onItself = await executeTool(asking, "copy_day", {
      from: today,
      to: null,
      entry_count: 3,
    });
    const empty = await executeTool(asking, "copy_day", {
      from: "2026-10-01",
      to: null,
      entry_count: 1,
    });

    assertEquals(payloadOf(onItself), { error: "invalid_input", fields: ["to"] });
    assertEquals(payloadOf(empty), { error: "invalid_input", fields: ["entry_count"] });
    assertEquals(mine(stub, today).length, 0);
    assertEquals(store.actions.length, 0);
  },
);

Deno.test(
  "a failure after the copy landed keeps the card and the action and loses only the stamp",
  async () => {
    const { asking, stub, store, reported } = copyContexts({
      food_log_entries: mealsOf(userId, yesterday),
    });
    // Three inserts land, then the write that gives the copies one shared stamp fails.
    stub.failNextWriteTo("food_log_entries", 3);

    const result = await executeTool(asking, "copy_day", copyOf(3));

    assertEquals(result.status, "ok");
    assertObjectMatch(structuredOf(result), { card: { title: "Copied 3 entries from yesterday" } });
    assertEquals(mine(stub, today).length, 3);
    assertEquals(store.actions[0]?.targetIds?.length, 3);
    assertEquals(store.actions[0]?.targetUpdatedAt, null);
    assertEquals(
      reported.map((failure) => failure.code),
      ["internal_error"],
    );
  },
);
