import { assert, assertEquals, assertFalse, assertObjectMatch } from "@std/assert";

import { assistantCardSchema, mergeAssistantCards } from "../../core.ts";
import { executeTool } from "../executor.ts";
import { createFakeContext, otherUserId, spyOnConsole, userId } from "../testing.ts";
import { undoOutcomeSchema } from "../store.ts";
import { undoAction } from "../undo.ts";
import { setRow, sessionRow, exerciseId } from "./trainingFixtures.ts";
import { updatePastSetTool } from "./updatePastSet.ts";
import { payloadOf } from "./testing.ts";
import { structuredOf } from "./writeFixtures.ts";
import { writeStub } from "./writeStub.ts";

import type { AssistantCard } from "../../core.ts";
import type { FakeContext } from "../testing.ts";
import type { ToolContext } from "../tool.ts";

const squat = { id: exerciseId(7), name: "Barbell squat", equipment: "barbell" };
const finishedSession = "00000000-0000-4000-8000-0000000b0001";
const liveSession = "00000000-0000-4000-8000-0000000b0002";
const deletedSession = "00000000-0000-4000-8000-0000000b0003";
const theirSession = "00000000-0000-4000-8000-0000000b0004";

const warmUpId = "00000000-0000-4000-8000-0000000c0010";
const setOneId = "00000000-0000-4000-8000-0000000c0011";
const setTwoId = "00000000-0000-4000-8000-0000000c0012";
const setThreeId = "00000000-0000-4000-8000-0000000c0013";
const liveSetId = "00000000-0000-4000-8000-0000000c0020";
const deletedSetId = "00000000-0000-4000-8000-0000000c0030";
const theirSetId = "00000000-0000-4000-8000-0000000c0040";

const setOf = (
  id: string,
  sessionId: string,
  position: number,
  overrides: Record<string, unknown> = {},
) => setRow(position, squat, { id, session_id: sessionId, ...overrides });

// Thursday 8 October, a Legs day: a warm-up and three working sets of the squat, at 220 pounds.
const thursdaySets = () => [
  setOf(warmUpId, finishedSession, 0, { set_type: "warmup", reps: 10, load_kg: 60, rir: null }),
  setOf(setOneId, finishedSession, 1, { reps: 7, load_kg: 99.79, rir: 2 }),
  setOf(setTwoId, finishedSession, 2, { reps: 6, load_kg: 100, rir: 2 }),
  setOf(setThreeId, finishedSession, 3, { reps: 7, load_kg: 99.79, rir: null, rpe: 8.5 }),
];

function rowsOf(unit: "kg" | "lb" = "kg") {
  const thursday = thursdaySets();
  const live = [setOf(liveSetId, liveSession, 1, { user_id: userId })];
  const deleted = [
    setOf(deletedSetId, deletedSession, 1, { deleted_at: "2026-10-09T10:00:00+00:00" }),
  ];
  const theirs = [setOf(theirSetId, theirSession, 1, { user_id: otherUserId, reps: 5 })];
  const session = (id: string, overrides: Record<string, unknown>, sets: unknown[]) =>
    sessionRow(1, {
      id,
      local_date: "2026-10-08",
      routine_days: { name: "Legs" },
      workout_sets: structuredClone(sets),
      ...overrides,
    });
  return {
    workout_sessions: [
      session(finishedSession, {}, thursday),
      session(liveSession, { ended_at: null }, live),
      session(deletedSession, { deleted_at: "2026-10-09T10:00:00+00:00" }, deleted),
      session(theirSession, { user_id: otherUserId }, theirs),
    ],
    workout_sets: [...thursday, ...live, ...deleted, ...theirs],
    profiles: [{ weight_unit: unit }],
  };
}

// A context whose caller is the in-memory training tables. A workout in progress is left out unless asked for.
function setContext(options: { unit?: "kg" | "lb"; live?: true } = {}) {
  const rows = rowsOf(options.unit);
  const stub = writeStub(
    options.live === true
      ? rows
      : {
          ...rows,
          workout_sessions: rows.workout_sessions.filter(({ id }) => id !== liveSession),
          workout_sets: rows.workout_sets.filter((row) => row["session_id"] !== liveSession),
        },
    { callerUserId: userId },
  );
  const made = createFakeContext([updatePastSetTool]);
  const ctx: ToolContext = { ...made.ctx, caller: stub.caller };
  return { ...made, ctx, stub };
}

// Every field a call can leave alone is null, so a test names only what it changes.
const keep = { reps: null, load: null, rir: null, rpe: null, set_type: null };

const rowOfSet = (stub: ReturnType<typeof writeStub>, id: string) =>
  stub.tables["workout_sets"]?.find((row) => row["id"] === id);

const storedOf = (stub: ReturnType<typeof writeStub>, id: string) => {
  const row = rowOfSet(stub, id);
  return {
    set_type: row?.["set_type"],
    reps: row?.["reps"],
    load_kg: row?.["load_kg"],
    rir: row?.["rir"],
    rpe: row?.["rpe"],
  };
};

const cardOf = (result: Awaited<ReturnType<typeof executeTool>>, actionId: string) => ({
  actionIds: [actionId],
  ...assistantCardSchema.omit({ actionIds: true }).parse(structuredOf(result)["card"]),
});

const undoOf = (result: Awaited<ReturnType<typeof executeTool>>) =>
  undoOutcomeSchema.parse(structuredOf(result)["undo"]);

// What the turn loop does after a landed write: it keeps the structured `undo` beside the action id.
function keepUndoOf(made: FakeContext, result: Awaited<ReturnType<typeof executeTool>>) {
  assert(result.status === "ok" && result.actionId !== null);
  made.store.previousValues.set(result.actionId, undoOf(result));
  return result.actionId;
}

Deno.test("reps change on the set and nothing else, and the card is the board's", async () => {
  const { ctx, stub, store } = setContext();

  const result = await executeTool(ctx, "update_past_set", {
    set_id: setTwoId,
    ...keep,
    reps: 8,
  });

  assert(result.status === "ok");
  assertEquals(storedOf(stub, setTwoId), {
    set_type: "working",
    reps: 8,
    load_kg: 100,
    rir: 2,
    rpe: null,
  });
  assertEquals(payloadOf(result), { updated: setTwoId, changed: true });
  assertObjectMatch(structuredOf(result), {
    card: {
      kind: "set_updated",
      title: "Changed a set in Legs",
      sub: "Thursday 8 October",
      rows: [
        { name: "Barbell squat, set 2", amountText: "Was 100 kg × 6", kcalText: "100 kg × 8" },
      ],
      changeDetail: "Thu 8 Oct",
      link: {
        label: "Open the session",
        target: { screen: "session_detail", sessionId: finishedSession },
      },
      undo: "available",
      undoneSub: "Put back barbell squat, set 2, to 100 kg × 6",
    },
  });
  assertEquals(store.actions[0]?.targetId, setTwoId);
  assertEquals(store.actions[0]?.targetTable, "workout_sets");
});

Deno.test("a load in kilograms is stored to the gram", async () => {
  const { ctx, stub } = setContext();

  await executeTool(ctx, "update_past_set", { set_id: setTwoId, ...keep, load: 102.5555 });

  assertEquals(rowOfSet(stub, setTwoId)?.["load_kg"], 102.556);
});

Deno.test(
  "a load in pounds is stored in kilograms to the gram and the card says pounds",
  async () => {
    const { ctx, stub } = setContext({ unit: "lb" });

    const result = await executeTool(ctx, "update_past_set", {
      set_id: setOneId,
      ...keep,
      load: 225,
    });

    assert(result.status === "ok");
    assertEquals(rowOfSet(stub, setOneId)?.["load_kg"], 102.058);
    assertObjectMatch(structuredOf(result), {
      card: { rows: [{ amountText: "Was 220 lb × 7", kcalText: "225 lb × 7" }] },
    });
  },
);

Deno.test("the unit is the one the profile holds, the one the app reads", async () => {
  const kilograms = setContext({ unit: "kg" });
  const pounds = setContext({ unit: "lb" });
  const input = { set_id: setOneId, ...keep, load: 100 };

  await executeTool(kilograms.ctx, "update_past_set", input);
  await executeTool(pounds.ctx, "update_past_set", input);

  assertEquals(rowOfSet(kilograms.stub, setOneId)?.["load_kg"], 100);
  assertEquals(rowOfSet(pounds.stub, setOneId)?.["load_kg"], 45.359);
});

Deno.test("a load past a thousand kilograms is refused in whatever unit it was given", async () => {
  const { ctx, stub } = setContext({ unit: "lb" });
  const before = structuredClone(rowOfSet(stub, setOneId));

  const result = await executeTool(ctx, "update_past_set", {
    set_id: setOneId,
    ...keep,
    load: 2300,
  });

  assertEquals(payloadOf(result), { error: "invalid_input", fields: ["load"] });
  assertEquals(rowOfSet(stub, setOneId), before);
});

Deno.test("setting an effort measure clears the other one, as the app's edit does", async () => {
  const { ctx, stub } = setContext();

  await executeTool(ctx, "update_past_set", { set_id: setOneId, ...keep, rpe: 9 });
  await executeTool(ctx, "update_past_set", { set_id: setThreeId, ...keep, rir: 1 });

  assertObjectMatch(storedOf(stub, setOneId), { rir: null, rpe: 9 });
  assertObjectMatch(storedOf(stub, setThreeId), { rir: 1, rpe: null });
});

Deno.test("a set type changes, and a warm-up is named without a number", async () => {
  const { ctx, stub } = setContext();

  const result = await executeTool(ctx, "update_past_set", {
    set_id: setOneId,
    ...keep,
    set_type: "warmup",
  });

  assertObjectMatch(storedOf(stub, setOneId), { set_type: "warmup" });
  assertObjectMatch(structuredOf(result), {
    card: {
      rows: [
        {
          name: "Barbell squat, warm-up set",
          amountText: "Was 99.8 kg × 7, working",
          kcalText: "99.8 kg × 7, warm-up",
        },
      ],
    },
  });
});

Deno.test("asking for what the set already holds writes nothing and keeps no action", async () => {
  const { ctx, stub, store } = setContext();

  const result = await executeTool(ctx, "update_past_set", {
    set_id: setTwoId,
    ...keep,
    reps: 6,
    load: 100,
  });

  assert(result.status === "ok");
  assertEquals(result.actionId, null);
  assertEquals(payloadOf(result), { updated: setTwoId, changed: false });
  assertFalse(stub.calls.some(({ method }) => method === "update"));
  assertEquals(store.actions.length, 0);
});

Deno.test(
  "a call that changes nothing, or sets both effort measures, is invalid input",
  async () => {
    const { ctx, stub } = setContext();

    const nothing = await executeTool(ctx, "update_past_set", { set_id: setTwoId, ...keep });
    const both = await executeTool(ctx, "update_past_set", {
      set_id: setTwoId,
      ...keep,
      rir: 1,
      rpe: 8,
    });
    const tooMany = await executeTool(ctx, "update_past_set", {
      set_id: setTwoId,
      ...keep,
      reps: 101,
    });

    assertEquals(nothing.status, "error");
    assertEquals(both.status, "error");
    assertEquals(tooMany.status, "error");
    assertFalse(stub.calls.some(({ method }) => method === "update"));
  },
);

Deno.test(
  "a set that does not exist, or was removed, is not found and writes nothing",
  async () => {
    const { ctx, stub } = setContext();

    const missing = await executeTool(ctx, "update_past_set", {
      set_id: "00000000-0000-4000-8000-0000000c0999",
      ...keep,
      reps: 8,
    });
    const removed = await executeTool(ctx, "update_past_set", {
      set_id: deletedSetId,
      ...keep,
      reps: 8,
    });

    assertEquals(payloadOf(missing), { error: "not_found" });
    assertEquals(payloadOf(removed), { error: "not_found" });
    assertFalse(stub.calls.some(({ method }) => method === "update"));
  },
);

Deno.test("another user's set reads as not found and is left as it was", async () => {
  const { ctx, stub } = setContext();

  const result = await executeTool(ctx, "update_past_set", {
    set_id: theirSetId,
    ...keep,
    reps: 8,
  });

  assertEquals(payloadOf(result), { error: "not_found" });
  assertEquals(rowOfSet(stub, theirSetId)?.["reps"], 5);
  assertFalse(stub.calls.some(({ method }) => method === "update"));
});

Deno.test("a set of a live session is refused by run, besides the executor's guard", async () => {
  const { ctx, stub } = setContext({ live: true });

  const output = await updatePastSetTool.run(ctx, { set_id: liveSetId, ...keep, reps: 8 });

  assertEquals(output.target, null);
  assertEquals(output.data, { error: "workout_in_progress" });
  assertFalse(stub.calls.some(({ method }) => method === "update"));
});

Deno.test("the executor refuses the tool while a workout is in progress", async () => {
  const { ctx, stub, store } = setContext({ live: true });

  const result = await executeTool(ctx, "update_past_set", { set_id: setTwoId, ...keep, reps: 8 });

  assertEquals(result.status, "error");
  assertEquals(result.status === "error" ? result.code : null, "workout_in_progress");
  assertEquals(rowOfSet(stub, setTwoId)?.["reps"], 6);
  assertEquals(store.actions.length, 0);
});

Deno.test(
  "a set of a deleted session is refused by run, even if the set still reads as live",
  async () => {
    const { ctx, stub } = setContext();
    stub.tables["workout_sets"]?.push(setOf(deletedSetId.replace("30", "31"), deletedSession, 2));

    const output = await updatePastSetTool.run(ctx, {
      set_id: deletedSetId.replace("30", "31"),
      ...keep,
      reps: 8,
    });

    assertEquals(output.target, null);
    assertEquals(output.data, { error: "not_found" });
    assertFalse(stub.calls.some(({ method }) => method === "update"));
  },
);

Deno.test("a write keeps the previous values and what it left in structured undo", async () => {
  const { ctx } = setContext();

  const result = await executeTool(ctx, "update_past_set", {
    set_id: setThreeId,
    ...keep,
    reps: 9,
    rir: 1,
    load: 101,
  });

  const undo = undoOf(result);
  assertEquals(undo.previous, {
    reps: 7,
    load_kg: 99.79,
    rir: null,
    rpe: 8.5,
    set_type: "working",
  });
  assertEquals(
    undo.fingerprint,
    JSON.stringify(["working", 9, 101, 1, null]),
    "the fingerprint is the one string the inverse compares, of what the write left",
  );
});

Deno.test("no value of a set reaches the model's answer, a log or a reported failure", async () => {
  const spy = spyOnConsole();
  try {
    const { ctx, stub, reported } = setContext();
    const landed = await executeTool(ctx, "update_past_set", {
      set_id: setTwoId,
      ...keep,
      reps: 13,
      load: 137.5,
    });
    stub.failNextWriteTo("workout_sets");
    const failed = await executeTool(ctx, "update_past_set", {
      set_id: setOneId,
      ...keep,
      reps: 17,
      load: 141.5,
    });

    assertEquals(failed.status === "error" ? failed.code : null, "tool_failed");
    const seen = JSON.stringify([landed.text, failed.text, reported, spy.lines]);
    for (const value of ["13", "137.5", "17", "141.5", "100", "99.79"]) {
      assertFalse(seen.includes(value), `${value} must not be in what the model or a log sees`);
    }
  } finally {
    spy.restore();
  }
});

Deno.test("undo puts back the reps, load, effort and type, to the gram", async () => {
  const made = setContext();
  const { ctx, stub } = made;
  const before = storedOf(stub, setThreeId);
  const result = await executeTool(ctx, "update_past_set", {
    set_id: setThreeId,
    ...keep,
    reps: 9,
    load: 101.2345,
    rir: 1,
    set_type: "drop",
  });
  const actionId = keepUndoOf(made, result);

  const undone = await undoAction(ctx, actionId);

  assertEquals(undone, { status: "undone", actionId });
  assertEquals(storedOf(stub, setThreeId), before);
});

Deno.test("undo answers changed when the person edited the set in the app since", async () => {
  const made = setContext();
  const { ctx, stub } = made;
  const result = await executeTool(ctx, "update_past_set", { set_id: setTwoId, ...keep, reps: 8 });
  const actionId = keepUndoOf(made, result);
  const row = rowOfSet(stub, setTwoId);
  assert(row !== undefined);
  row["reps"] = 9;

  const undone = await undoAction(ctx, actionId);

  assertEquals(undone, { status: "error", code: "undo_unavailable", reason: "changed" });
  assertEquals(row["reps"], 9);
  assertEquals(made.store.actions[0]?.undoneAt, null, "the claim is given back");
});

Deno.test("undo answers changed when the set was removed or its session was deleted", async () => {
  const removed = setContext();
  const removedResult = await executeTool(removed.ctx, "update_past_set", {
    set_id: setTwoId,
    ...keep,
    reps: 8,
  });
  const removedAction = keepUndoOf(removed, removedResult);
  const removedRow = rowOfSet(removed.stub, setTwoId);
  assert(removedRow !== undefined);
  removedRow["deleted_at"] = "2026-10-09T10:00:00+00:00";

  const sessionGone = setContext();
  const sessionResult = await executeTool(sessionGone.ctx, "update_past_set", {
    set_id: setTwoId,
    ...keep,
    reps: 8,
  });
  const sessionAction = keepUndoOf(sessionGone, sessionResult);
  const sessionRowOfSet = sessionGone.stub.tables["workout_sessions"]?.find(
    (row) => row["id"] === finishedSession,
  );
  assert(sessionRowOfSet !== undefined);
  sessionRowOfSet["deleted_at"] = "2026-10-09T10:00:00+00:00";

  assertEquals(await undoAction(removed.ctx, removedAction), {
    status: "error",
    code: "undo_unavailable",
    reason: "changed",
  });
  assertEquals(await undoAction(sessionGone.ctx, sessionAction), {
    status: "error",
    code: "undo_unavailable",
    reason: "changed",
  });
});

Deno.test("undo answers unavailable when the stored value is gone", async () => {
  const made = setContext();
  const result = await executeTool(made.ctx, "update_past_set", {
    set_id: setTwoId,
    ...keep,
    reps: 8,
  });
  assert(result.status === "ok" && result.actionId !== null);

  const undone = await undoAction(made.ctx, result.actionId);

  assertEquals(undone, { status: "error", code: "undo_unavailable", reason: "changed" });
  assertEquals(rowOfSet(made.stub, setTwoId)?.["reps"], 8);
});

Deno.test("undo waits while a workout is in progress and the action stays undoable", async () => {
  const made = setContext();
  const result = await executeTool(made.ctx, "update_past_set", {
    set_id: setTwoId,
    ...keep,
    reps: 8,
  });
  const actionId = keepUndoOf(made, result);
  made.stub.tables["workout_sessions"]?.push(sessionRow(9, { ended_at: null, workout_sets: [] }));

  const waiting = await undoAction(made.ctx, actionId);
  made.stub.tables["workout_sessions"]?.pop();
  const later = await undoAction(made.ctx, actionId);

  assertEquals(waiting, {
    status: "error",
    code: "undo_unavailable",
    reason: "workout_in_progress",
  });
  assertEquals(later, { status: "undone", actionId });
  assertEquals(rowOfSet(made.stub, setTwoId)?.["reps"], 6);
});

// Three calls in one turn, as the model makes them, each in a slot of its own.
async function threeCalls(made: ReturnType<typeof setContext>) {
  const inputs = [setOneId, setTwoId, setThreeId].map((set_id) => ({
    set_id,
    ...keep,
    load: 102.058,
  }));
  const results = [];
  for (const input of inputs) {
    results.push(await executeTool(made.ctx, "update_past_set", input));
  }
  return results;
}

Deno.test(
  "three calls in a turn are three actions that merge into one card of three rows",
  async () => {
    const made = setContext({ unit: "kg" });

    const results = await threeCalls(made);

    const actionIds = results.map((result) => {
      assert(result.status === "ok" && result.actionId !== null);
      return result.actionId;
    });
    assertEquals(new Set(actionIds).size, 3);
    const cards: AssistantCard[] = results.map((result, index) =>
      cardOf(result, actionIds[index] ?? ""),
    );
    const [first, ...others] = cards;
    assert(first !== undefined);
    const merged = mergeAssistantCards([first, ...others]);
    assertEquals(merged.title, "Changed 3 sets in Legs");
    assertEquals(merged.actionIds, actionIds);
    assertEquals(
      merged.rows.map((row) => row.name),
      ["Barbell squat, set 1", "Barbell squat, set 2", "Barbell squat, set 3"],
    );
    assertEquals(merged.undoneSub, "Put back 3 sets in Legs");
  },
);

Deno.test("one Undo of the merged card puts all three sets back", async () => {
  const made = setContext();
  const before = [setOneId, setTwoId, setThreeId].map((id) => storedOf(made.stub, id));
  const results = await threeCalls(made);
  const actionIds = results.map((result) => keepUndoOf(made, result));

  const answers = [];
  for (const actionId of actionIds) {
    answers.push(await undoAction(made.ctx, actionId));
  }

  assertEquals(
    answers.map((answer) => answer.status),
    ["undone", "undone", "undone"],
  );
  assertEquals(
    [setOneId, setTwoId, setThreeId].map((id) => storedOf(made.stub, id)),
    before,
  );
});

Deno.test(
  "when one of the three was edited in the app, Undo puts two back and says changed for that one",
  async () => {
    const made = setContext();
    const results = await threeCalls(made);
    const actionIds = results.map((result) => keepUndoOf(made, result));
    const edited = rowOfSet(made.stub, setTwoId);
    assert(edited !== undefined);
    edited["reps"] = 12;

    const answers = [];
    for (const actionId of actionIds) {
      answers.push(await undoAction(made.ctx, actionId));
    }

    assertEquals(answers, [
      { status: "undone", actionId: actionIds[0] },
      { status: "error", code: "undo_unavailable", reason: "changed" },
      { status: "undone", actionId: actionIds[2] },
    ]);
    assertEquals(rowOfSet(made.stub, setOneId)?.["load_kg"], 99.79);
    assertEquals(rowOfSet(made.stub, setTwoId)?.["load_kg"], 102.058);
    assertEquals(rowOfSet(made.stub, setTwoId)?.["reps"], 12);
    assertEquals(rowOfSet(made.stub, setThreeId)?.["load_kg"], 99.79);
  },
);

Deno.test("the tool is a write of workout sets that refuses a workout in progress", () => {
  assertEquals(updatePastSetTool.kind, "write");
  assertEquals(updatePastSetTool.targetTable, "workout_sets");
  assertEquals(updatePastSetTool.refusesDuringWorkout, true);
  assertEquals(updatePastSetTool.strict, false);
});
