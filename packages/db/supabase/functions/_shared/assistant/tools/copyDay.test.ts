import {
  assert,
  assertEquals,
  assertFalse,
  assertObjectMatch,
  assertStringIncludes,
} from "@std/assert";

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
import { confirmWordsFor } from "../../../assistant/confirmWords.ts";
import { dietRows, fixClock, structuredOf } from "./writeFixtures.ts";
import { writeStub } from "./writeStub.ts";

import type { ReportedFailure } from "../testing.ts";
import type { ToolContext } from "../tool.ts";

const earlier = "00000000-0000-4000-8000-0000000000d1";
const later = "00000000-0000-4000-8000-0000000000d2";
const otherUser = "00000000-0000-4000-8000-0000000000b2";
const yesterday = "2026-11-02";
const today = "2026-11-03";

// The person's today is read from the clock, so the clock stops on the day the fixtures are written for.
fixClock("2026-11-03T12:00:00.000Z");

const labels = ["Porridge", "Sandwich", "Chicken and rice"];
const kcals = [300, 450, 650];

// Yesterday's meals at 08:00, 13:00 and 19:00. Hers are another user's and must never be read or copied.
const mealsOf = (owner: string, localDate: string, count = labels.length, idOffset = 0) =>
  Array.from({ length: count }, (_, index) => ({
    ...quickEntryRow(
      {
        number: (owner === userId ? 100 : 900) + idOffset + index,
        localDate,
        loggedAt: `${localDate}T${String(8 + (index % 12)).padStart(2, "0")}:${String(Math.floor(index / 12)).padStart(2, "0")}:00.000Z`,
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
function copyContexts(rows: Diary, options: { slotLimit?: number; viewing?: string } = {}) {
  const stub = writeStub({ ...dietRows(), ...rows }, { callerUserId: userId });
  const store = createFakeActionStore({
    turns: turnsOfConversation([earlier, later]),
    ...(options.slotLimit === undefined ? {} : { slotLimit: options.slotLimit }),
  });
  const reported: ReportedFailure[] = [];
  const contextOn = (turnId: string): ToolContext => {
    const made = createFakeContext([copyDayTool], {
      store,
      personsWords: "Copy 3 entries",
      turn: { id: turnId, conversationId: store.turns[0]?.conversationId ?? "" },
      localDate: options.viewing ?? today,
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

const copyOf = (entryCount: number, to: string = today) => ({
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

Deno.test("a copy onto another day names that day in the card", async () => {
  const { asking, stub } = copyContexts({ food_log_entries: mealsOf(userId, yesterday) });

  const result = await executeTool(asking, "copy_day", copyOf(3, "2026-11-01"));

  assertEquals(result.status, "ok");
  assertEquals(mine(stub, "2026-11-01").length, 3);
  assertEquals(mine(stub, today).length, 0);
  assertObjectMatch(structuredOf(result), {
    card: { sub: "Monday 2 November to Sunday 1 November · 1,400 kcal" },
  });
});

Deno.test(
  "a copy onto a day with 3 entries answers needs_confirmation, and with the spent confirmation copies and keeps the 3",
  async () => {
    const { asking, confirming, stub, store } = copyContexts({
      food_log_entries: [...mealsOf(userId, yesterday, 3), ...mealsOf(userId, today, 3, 500)],
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
  "a confirmation given for a copy with another from or another to is refused and nothing is copied",
  async () => {
    const { asking, confirming, stub } = copyContexts({
      food_log_entries: [
        ...mealsOf(userId, yesterday),
        ...mealsOf(userId, "2026-10-31", 3, 200),
        ...mealsOf(userId, today, 1, 400),
        ...mealsOf(userId, "2026-11-01", 1, 600),
      ],
    });
    const asked = await executeTool(asking, "copy_day", copyOf(3));
    assert(asked.status === "needs_confirmation");
    const confirmation_id = asked.confirmationId;

    // Each of these would be a copy that asks, so only the hash of the input can refuse it.
    const otherFrom = await executeTool(confirming, "copy_day", {
      ...copyOf(3),
      from: "2026-10-31",
      confirmation_id,
    });
    const otherTo = await executeTool(confirming, "copy_day", {
      ...copyOf(3, "2026-11-01"),
      confirmation_id,
    });

    for (const result of [otherFrom, otherTo]) {
      assertEquals(result.status, "error");
      assertEquals(payloadOf(result), { error: "confirmation_invalid" });
    }
    assertEquals(mine(stub, today).length, 1);
    assertEquals(mine(stub, "2026-11-01").length, 1);
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

Deno.test("a day cannot be copied onto itself, even when it has entries to ask about", async () => {
  const { asking, stub, store } = copyContexts({ food_log_entries: mealsOf(userId, today) });

  const result = await executeTool(asking, "copy_day", { from: today, to: today, entry_count: 3 });

  assertEquals(result.status, "ok");
  assertEquals(payloadOf(result), { error: "invalid_input", fields: ["to"] });
  assertEquals(mine(stub, today).length, 3);
  assertEquals(store.actions.length, 0);
});

Deno.test("a day with nothing on it is not copied", async () => {
  const { asking, stub, store } = copyContexts({ food_log_entries: mealsOf(userId, yesterday) });

  const result = await executeTool(asking, "copy_day", {
    from: "2026-10-01",
    to: today,
    entry_count: 1,
  });

  assertEquals(payloadOf(result), { error: "invalid_input", fields: ["entry_count"] });
  assertEquals(mine(stub, today).length, 0);
  assertEquals(store.actions.length, 0);
});

// A refusal that `run` would make must not be asked about first: no confirmation is stored, so the
// loop shows no button for a copy that cannot happen.
Deno.test(
  "a copy that run would refuse does not ask, whether the count is wrong or the day is empty",
  async () => {
    const { asking, store, stub } = copyContexts({
      food_log_entries: [...mealsOf(userId, yesterday), ...mealsOf(userId, today, 2, 500)],
    });

    const wrongCount = await executeTool(asking, "copy_day", copyOf(8));
    const emptySource = await executeTool(asking, "copy_day", {
      from: "2026-10-01",
      to: today,
      entry_count: 1,
    });

    assertEquals(wrongCount.status, "ok");
    assertEquals(payloadOf(wrongCount), { error: "invalid_input", fields: ["entry_count"] });
    assertEquals(emptySource.status, "ok");
    assertEquals(payloadOf(emptySource), { error: "invalid_input", fields: ["entry_count"] });
    assertEquals(store.turns[0]?.pending, null);
    assertEquals(mine(stub, today).length, 2);
  },
);

Deno.test(
  "a day of more than 100 entries is answered clearly and never copied or asked about",
  async () => {
    const { asking, stub, store } = copyContexts({
      food_log_entries: [...mealsOf(userId, yesterday, 101), ...mealsOf(userId, today, 1, 500)],
    });

    const result = await executeTool(asking, "copy_day", copyOf(101));

    assertEquals(result.status, "ok");
    assertEquals(payloadOf(result), { error: "too_many_entries", limit: 100 });
    assertEquals(mine(stub, today).length, 1);
    assertEquals(store.actions.length, 0);
    assertEquals(store.turns[0]?.pending, null);
  },
);

Deno.test("a day of exactly 100 entries is copied", async () => {
  const { asking, stub } = copyContexts({ food_log_entries: mealsOf(userId, yesterday, 100) });

  const result = await executeTool(asking, "copy_day", copyOf(100));

  assertEquals(result.status, "ok");
  assertEquals(mine(stub, today).length, 100);
});

Deno.test(
  "the card says yesterday and today by the person's own today, not by the day their sheet shows",
  async () => {
    const { asking, stub } = copyContexts(
      { food_log_entries: mealsOf(userId, "2026-11-01") },
      { viewing: yesterday },
    );

    const result = await executeTool(asking, "copy_day", {
      from: "2026-11-01",
      to: yesterday,
      entry_count: 3,
    });

    assertEquals(result.status, "ok");
    assertEquals(mine(stub, yesterday).length, 3);
    assertObjectMatch(structuredOf(result), {
      card: {
        title: "Copied 3 entries from Sun 1 Nov",
        sub: "Sunday 1 November to Monday 2 November · 1,400 kcal",
        undoneSub: "Removed 3 copied entries from Mon 2 Nov",
      },
    });
  },
);

Deno.test(
  "a copy that stops part way and cannot take its copies back keeps them as an action Undo can remove",
  async () => {
    const { asking, stub, store, reported } = copyContexts({
      food_log_entries: mealsOf(userId, yesterday),
    });
    // The first copy lands, the second insert fails, and so does the write that takes the first back.
    stub.failNextWriteTo("food_log_entries", 1, 2);

    const result = await executeTool(asking, "copy_day", copyOf(3));

    assert(result.status === "ok" && result.actionId !== null);
    assertEquals(payloadOf(result), { error: "copy_incomplete", copied: 1 });
    assertEquals(structuredOf(result), {});
    assertEquals(mine(stub, today).length, 1);
    assertEquals(store.actions.length, 1);
    assertEquals(store.actions[0]?.targetIds?.length, 1);
    assertEquals(store.actions[0]?.targetLocalDate, today);
    assertEquals(
      reported.map((failure) => failure.code),
      ["internal_error"],
    );
    assertFalse(
      JSON.stringify(reported.map((failure) => String(failure.caught))).includes("Porridge"),
    );

    const undone = await undoAction(asking, result.actionId);

    assertEquals(undone, { status: "undone", actionId: result.actionId });
    assertEquals(mine(stub, today).length, 0);
  },
);

Deno.test(
  "when the copies cannot be read back the card is kept and only the kcal is left off",
  async () => {
    const { asking, stub } = copyContexts({ food_log_entries: mealsOf(userId, yesterday) });
    // Reads of the entries: the confirmation check takes two, run one, the repo one and the stamp one.
    // The sixth is the read-back for the card.
    stub.failNextReadFrom("food_log_entries", 5);

    const result = await executeTool(asking, "copy_day", copyOf(3));

    assertEquals(result.status, "ok");
    assertObjectMatch(structuredOf(result), {
      card: {
        title: "Copied 3 entries from yesterday",
        sub: "Monday 2 November to today",
        undoneSub: "Removed 3 copied entries from today",
      },
    });
    assertEquals(mine(stub, today).length, 3);
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

Deno.test("the question is the board's, and the label is its button", async () => {
  const { asking } = copyContexts({
    food_log_entries: [...mealsOf(userId, yesterday, 3), ...mealsOf(userId, today, 3, 500)],
  });

  const asked = await executeTool(asking, "copy_day", copyOf(3));
  const need = await copyDayTool.needsConfirmation?.(copyOf(3), asking);

  assert(asked.status === "needs_confirmation");
  assertEquals(
    asked.question,
    "Today already has 3 entries. Add yesterday's 3 entries to them? Nothing is replaced.",
  );
  assertEquals(
    need !== false && need !== undefined ? need.confirmLabel : null,
    confirmWordsFor("copy_day", copyOf(3))?.confirmLabel,
  );
});

Deno.test(
  "the description tells the model to word the question in the same response as the call",
  () => {
    const { description } = copyDayTool;

    assertStringIncludes(
      description,
      "in the same response as the call, before it, write the question",
    );
    assertStringIncludes(description, "When they say no, do not call again.");
    assertFalse(description.includes("ask the user"));
  },
);

Deno.test("after a typed yes the confirmation asks again and nothing is copied", async () => {
  const { asking, confirming, stub, store } = copyContexts({
    food_log_entries: [...mealsOf(userId, yesterday, 3), ...mealsOf(userId, today, 3, 500)],
  });
  const asked = await executeTool(asking, "copy_day", copyOf(3));
  assert(asked.status === "needs_confirmation");

  const result = await executeTool(
    { ...confirming, turn: { ...confirming.turn, personsWords: "yes please" } },
    "copy_day",
    { ...copyOf(3), confirmation_id: asked.confirmationId },
  );

  assertObjectMatch(result, { status: "needs_confirmation", asksAgain: true });
  assertEquals(mine(stub, today).length, 3);
  assertEquals(store.actions.length, 0);
});
