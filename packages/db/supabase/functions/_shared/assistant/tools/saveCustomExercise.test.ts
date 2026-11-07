import {
  assert,
  assertEquals,
  assertFalse,
  assertObjectMatch,
  assertStringIncludes,
} from "@std/assert";

import { executeTool } from "../executor.ts";
import { spyOnConsole } from "../testing.ts";
import { undoAction } from "../undo.ts";
import {
  cableCrunch,
  exerciseContext,
  keepUndoOf,
  libraryPress,
  missingExerciseId,
  theirsCrunch,
  undoOf,
} from "./customExerciseFixtures.ts";
import { saveCustomExerciseTool } from "./saveCustomExercise.ts";
import { payloadOf, stubCaller } from "./testing.ts";
import { sessionRow } from "./trainingFixtures.ts";
import { structuredOf } from "./writeFixtures.ts";

const setup = (rows: Record<string, Record<string, unknown>[]> = {}) =>
  exerciseContext([saveCustomExerciseTool], rows);

const nameOf = (stub: ReturnType<typeof setup>["stub"], id: string) =>
  stub.tables["exercises"]?.find((row) => row["id"] === id)?.["name"];

const targetIdOf = (id: string | null | undefined): string => {
  assert(typeof id === "string");
  return id;
};

const abs = { muscle_id: "abs", role: "primary" };
const obliques = { muscle_id: "obliques", role: "secondary" };

const add = (name = "Cable crunch") => ({
  id: null,
  name,
  equipment: "cable",
  muscles: [abs],
});

const rename = {
  id: cableCrunch["id"],
  name: "Kneeling cable crunch",
  equipment: null,
  muscles: [abs, obliques],
};

Deno.test(
  "adding an exercise saves the user's own and builds the board's card, with no link",
  async () => {
    const { ctx, stub, store } = setup();

    const result = await executeTool(ctx, "save_custom_exercise", add("Hanging leg raise"));

    assertEquals(result.status, "ok");
    const created = stub.tables["exercises"]?.find((row) => row["name"] === "Hanging leg raise");
    assertObjectMatch(created ?? {}, {
      owner_id: "00000000-0000-4000-8000-0000000000a1",
      source: "user",
      equipment: "cable",
      mechanic: "isolation",
    });
    assertObjectMatch(structuredOf(result), {
      card: {
        kind: "exercise_created",
        title: "Added exercise Hanging leg raise",
        sub: "Custom · Cable · Abs",
        note: "Not in a routine yet. Say which day, or add it in the routine editor.",
        link: null,
        undo: "available",
        undoneSub: "Archived Hanging leg raise",
      },
    });
    const [action] = store.actions;
    assertEquals(action?.tool, "save_custom_exercise");
    assertEquals(action?.targetTable, "exercises");
    assertEquals(action?.targetId, created?.["id"]);
  },
);

Deno.test(
  "a landed write holds the previous value and the fingerprint under undo, and nowhere the model reads",
  async () => {
    const { ctx } = setup();

    const added = await executeTool(ctx, "save_custom_exercise", add("Hanging leg raise"));
    const edited = await executeTool(ctx, "save_custom_exercise", {
      ...rename,
      name: "Pulldown abs",
    });

    assertEquals(undoOf(added).previous, null);
    assertEquals(typeof undoOf(added).fingerprint, "string");
    assertEquals(undoOf(edited).previous, {
      name: "Cable crunch",
      equipment: "cable",
      muscles: [abs],
    });
    assertEquals(typeof undoOf(edited).fingerprint, "string");
    assertFalse(edited.text.includes("Cable crunch"));
  },
);

Deno.test("an edit changes the name and the muscles and draws a row for each", async () => {
  const { ctx, stub } = setup();

  const result = await executeTool(ctx, "save_custom_exercise", rename);

  assertEquals(result.status, "ok");
  assertEquals(nameOf(stub, String(cableCrunch["id"])), "Kneeling cable crunch");
  assertObjectMatch(structuredOf(result), {
    card: {
      kind: "exercise_updated",
      title: "Updated exercise Kneeling cable crunch",
      sub: null,
      rows: [
        { name: "Name", amountText: "Was Cable crunch" },
        { name: "Muscles", amountText: "Abs, obliques · was Abs" },
      ],
      note: "Sets you already logged keep what they were.",
      link: null,
      undo: "available",
      undoneSub: "Put back Cable crunch, on the cable, for abs",
    },
  });
});

Deno.test("an edit with a null keeps that value", async () => {
  const { ctx, stub } = setup();

  const result = await executeTool(ctx, "save_custom_exercise", {
    id: cableCrunch["id"],
    name: null,
    equipment: "machine",
    muscles: null,
  });

  assertEquals(result.status, "ok");
  const stored = stub.tables["exercises"]?.find((row) => row["id"] === cableCrunch["id"]);
  assertObjectMatch(stored ?? {}, { name: "Cable crunch", equipment: "machine" });
  assertEquals(stored?.["exercise_muscles"], [{ muscle_id: "abs", role: "primary", weight: 1 }]);
});

Deno.test("an edit that changes nothing writes nothing and keeps no action", async () => {
  const { ctx, stub, store } = setup();

  const result = await executeTool(ctx, "save_custom_exercise", {
    id: cableCrunch["id"],
    name: " Cable crunch ",
    equipment: "cable",
    muscles: [abs],
  });

  assertObjectMatch(result, { status: "ok", actionId: null });
  assertEquals(payloadOf(result), { id: cableCrunch["id"], changed: false });
  assertEquals(structuredOf(result), {});
  assertEquals(store.actions.length, 0);
  assertEquals(
    stub.calls.filter(({ table }) => table === "rpc:save_exercise"),
    [],
  );
});

Deno.test("a library exercise is refused, and nothing is written", async () => {
  const { ctx, stub, store } = setup();

  const result = await executeTool(ctx, "save_custom_exercise", {
    ...rename,
    id: libraryPress["id"],
  });

  assertEquals(payloadOf(result), { error: "global_exercise" });
  assertEquals(store.actions.length, 0);
  assertEquals(nameOf(stub, String(libraryPress["id"])), "Barbell bench press");
});

Deno.test("another user's exercise, and one that does not exist, are not found", async () => {
  const { ctx, stub, store } = setup();

  for (const id of [theirsCrunch["id"], missingExerciseId]) {
    const result = await executeTool(ctx, "save_custom_exercise", { ...rename, id });

    assertEquals(payloadOf(result), { error: "not_found" });
  }
  assertEquals(nameOf(stub, String(theirsCrunch["id"])), "Their crunch");
  assertEquals(store.actions.length, 0);
});

Deno.test("an archived exercise is not found, so the model points to Undo", async () => {
  const { ctx, store } = setup({
    exercises: [{ ...cableCrunch, deleted_at: "2026-11-05T10:00:00+00:00" }],
  });

  const result = await executeTool(ctx, "save_custom_exercise", rename);

  assertEquals(payloadOf(result), { error: "not_found" });
  assertEquals(store.actions.length, 0);
  assertStringIncludes(saveCustomExerciseTool.description, "What the assistant changed");
});

Deno.test(
  "an exercise with no primary muscle is refused with the rule, and nothing is created",
  async () => {
    const { ctx, stub, store } = setup();

    const result = await executeTool(ctx, "save_custom_exercise", {
      ...add(),
      muscles: [obliques],
    });

    assertEquals(payloadOf(result), {
      error: "invalid_input",
      fields: ["muscles"],
      rules: ["primary_missing"],
    });
    assertEquals(stub.tables["exercises"]?.length, 3);
    assertEquals(store.actions.length, 0);
  },
);

Deno.test("an edit that leaves no primary muscle is refused as well", async () => {
  const { ctx, store } = setup();

  const result = await executeTool(ctx, "save_custom_exercise", {
    ...rename,
    muscles: [obliques],
  });

  assertEquals(payloadOf(result), {
    error: "invalid_input",
    fields: ["muscles"],
    rules: ["primary_missing"],
  });
  assertEquals(store.actions.length, 0);
});

Deno.test("a muscle that is not on Ki-Lo's list is refused by the schema", async () => {
  const { ctx } = setup();

  const result = await executeTool(ctx, "save_custom_exercise", {
    ...add(),
    muscles: [{ muscle_id: "pecs", role: "primary" }],
  });

  assertObjectMatch(result, { status: "error", code: "invalid_input" });
});

Deno.test("adding needs a name, an equipment and the muscles", async () => {
  const { ctx } = setup();

  const result = await executeTool(ctx, "save_custom_exercise", {
    id: null,
    name: null,
    equipment: null,
    muscles: null,
  });

  assertEquals(payloadOf(result), {
    error: "invalid_input",
    fields: ["name", "equipment", "muscles"],
  });
});

Deno.test("undoing an added exercise archives it", async () => {
  const { ctx, stub, store } = setup();
  const added = await executeTool(ctx, "save_custom_exercise", add("Hanging leg raise"));
  keepUndoOf(added, store);
  assert(added.status === "ok" && added.actionId !== null);

  const result = await undoAction(ctx, added.actionId);

  assertEquals(result, { status: "undone", actionId: added.actionId });
  const created = stub.tables["exercises"]?.find((row) => row["name"] === "Hanging leg raise");
  assertEquals(typeof created?.["deleted_at"], "string");
});

Deno.test("an added exercise cannot be undone once it was changed since", async () => {
  const { ctx, stub, store } = setup();
  const added = await executeTool(ctx, "save_custom_exercise", add("Hanging leg raise"));
  keepUndoOf(added, store);
  assert(added.status === "ok" && added.actionId !== null);
  await executeTool(ctx, "save_custom_exercise", {
    id: targetIdOf(store.actions[0]?.targetId),
    name: "Hanging knee raise",
    equipment: null,
    muscles: null,
  });

  const result = await undoAction(ctx, added.actionId);

  assertEquals(result, { status: "error", code: "undo_unavailable", reason: "changed" });
  assertEquals(
    stub.tables["exercises"]?.find((row) => row["name"] === "Hanging knee raise")?.["deleted_at"],
    null,
  );
});

Deno.test("an added exercise cannot be undone once a routine names it", async () => {
  const { ctx, store, stub } = setup({
    routines: [{ id: "r1", user_id: "00000000-0000-4000-8000-0000000000a1", is_archived: true }],
  });
  const added = await executeTool(ctx, "save_custom_exercise", add("Hanging leg raise"));
  keepUndoOf(added, store);
  assert(added.status === "ok" && added.actionId !== null);
  const exerciseId = targetIdOf(store.actions[0]?.targetId);
  // An archived routine counts too: restoring it would point at an exercise nothing could bring back.
  stub.tables["routine_exercises"] = [
    { id: "re1", user_id: "00000000-0000-4000-8000-0000000000a1", exercise_id: exerciseId },
  ];

  const result = await undoAction(ctx, added.actionId);

  assertEquals(result, { status: "error", code: "undo_unavailable", reason: "used" });
  assertEquals(
    stub.tables["exercises"]?.find((row) => row["id"] === exerciseId)?.["deleted_at"],
    null,
  );
});

Deno.test(
  "an added exercise cannot be undone once a set was logged with it, even a deleted one",
  async () => {
    const { ctx, store, stub } = setup();
    const added = await executeTool(ctx, "save_custom_exercise", add("Hanging leg raise"));
    keepUndoOf(added, store);
    assert(added.status === "ok" && added.actionId !== null);
    const exerciseId = targetIdOf(store.actions[0]?.targetId);
    stub.tables["workout_sets"] = [
      {
        id: "s1",
        user_id: "00000000-0000-4000-8000-0000000000a1",
        exercise_id: exerciseId,
        deleted_at: "2026-11-06T10:00:00+00:00",
      },
    ];

    const result = await undoAction(ctx, added.actionId);

    assertEquals(result, { status: "error", code: "undo_unavailable", reason: "used" });
  },
);

Deno.test("an added exercise is not used by another exercise's sets", async () => {
  const { ctx, store, stub } = setup();
  const added = await executeTool(ctx, "save_custom_exercise", add("Hanging leg raise"));
  keepUndoOf(added, store);
  assert(added.status === "ok" && added.actionId !== null);
  stub.tables["workout_sets"] = [
    { id: "s1", user_id: "00000000-0000-4000-8000-0000000000a1", exercise_id: cableCrunch["id"] },
  ];
  stub.tables["routine_exercises"] = [
    { id: "re1", user_id: "00000000-0000-4000-8000-0000000000a1", exercise_id: libraryPress["id"] },
  ];

  const result = await undoAction(ctx, added.actionId);

  assertEquals(result, { status: "undone", actionId: added.actionId });
});

Deno.test("an edit's Undo puts the name, equipment and muscles back", async () => {
  const { ctx, store, stub } = setup();
  const edited = await executeTool(ctx, "save_custom_exercise", {
    ...rename,
    equipment: "machine",
  });
  keepUndoOf(edited, store);
  assert(edited.status === "ok" && edited.actionId !== null);

  const result = await undoAction(ctx, edited.actionId);

  assertEquals(result, { status: "undone", actionId: edited.actionId });
  const stored = stub.tables["exercises"]?.find((row) => row["id"] === cableCrunch["id"]);
  assertObjectMatch(stored ?? {}, { name: "Cable crunch", equipment: "cable" });
  assertEquals(stored?.["exercise_muscles"], [{ muscle_id: "abs", role: "primary", weight: 1 }]);
});

Deno.test(
  "an edit cannot be undone once it was edited again, and the later edit stays",
  async () => {
    const { ctx, store, stub } = setup();
    const first = await executeTool(ctx, "save_custom_exercise", rename);
    keepUndoOf(first, store);
    assert(first.status === "ok" && first.actionId !== null);
    await executeTool(ctx, "save_custom_exercise", { ...rename, name: "Rope crunch" });

    const result = await undoAction(ctx, first.actionId);

    assertEquals(result, { status: "error", code: "undo_unavailable", reason: "changed" });
    assertEquals(nameOf(stub, String(cableCrunch["id"])), "Rope crunch");
  },
);

Deno.test(
  "once the conversation is deleted an edit and an addition can no longer be undone",
  async () => {
    const { ctx, store, stub } = setup();
    const edited = await executeTool(ctx, "save_custom_exercise", rename);
    const added = await executeTool(ctx, "save_custom_exercise", add("Hanging leg raise"));
    assert(edited.status === "ok" && edited.actionId !== null);
    assert(added.status === "ok" && added.actionId !== null);
    // The stored values went with the conversation: nothing was kept for the store to answer.
    assertEquals(store.previousValues.size, 0);

    assertEquals(await undoAction(ctx, edited.actionId), {
      status: "error",
      code: "undo_unavailable",
    });
    assertEquals(await undoAction(ctx, added.actionId), {
      status: "error",
      code: "undo_unavailable",
    });
    assertEquals(nameOf(stub, String(cableCrunch["id"])), "Kneeling cable crunch");
  },
);

Deno.test("a live workout refuses the write and its Undo", async () => {
  const { ctx, store } = setup();
  const edited = await executeTool(ctx, "save_custom_exercise", rename);
  keepUndoOf(edited, store);
  assert(edited.status === "ok" && edited.actionId !== null);
  const duringWorkout = {
    ...ctx,
    caller: stubCaller({ tables: { workout_sessions: [sessionRow(1, { ended_at: null })] } })
      .caller,
  };

  const refused = await executeTool(
    duringWorkout,
    "save_custom_exercise",
    add("Hanging leg raise"),
  );
  const undone = await undoAction(duringWorkout, edited.actionId);

  assertObjectMatch(refused, { status: "error", code: "workout_in_progress" });
  assertEquals(undone, {
    status: "error",
    code: "undo_unavailable",
    reason: "workout_in_progress",
  });
  assertEquals(saveCustomExerciseTool.refusesDuringWorkout, true);
});

Deno.test("nothing about the exercise is logged", async () => {
  const spy = spyOnConsole();
  try {
    const { ctx, store } = setup();
    const edited = await executeTool(ctx, "save_custom_exercise", rename);
    keepUndoOf(edited, store);
    assert(edited.status === "ok" && edited.actionId !== null);
    await undoAction(ctx, edited.actionId);
    await executeTool(ctx, "save_custom_exercise", { ...rename, id: missingExerciseId });
  } finally {
    spy.restore();
  }

  assertEquals(spy.lines, []);
});

Deno.test("the tool opts out of strict mode and is a destructive-free write", () => {
  assertEquals(saveCustomExerciseTool.strict, false);
  assertEquals(saveCustomExerciseTool.annotations, { readOnlyHint: false, destructiveHint: false });
  assertEquals(saveCustomExerciseTool.targetTable, "exercises");
});
