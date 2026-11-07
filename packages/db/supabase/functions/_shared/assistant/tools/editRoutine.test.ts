import { assert, assertEquals, assertFalse, assertStringIncludes } from "@std/assert";

import {
  GOAL_PRESETS_V1,
  REMOVE_DAY_REFUSAL,
  draftOfStoredRoutine,
  exerciseTargetFor,
  routineFingerprint,
} from "../../core.ts";
import { getRoutine } from "../../repos.ts";
import { executeTool } from "../executor.ts";
import { toJsonSchema } from "../tool.ts";
import { undoAction } from "../undo.ts";
import { editRoutineTool } from "./editRoutine.ts";
import { change, dayId, ids, routineWorld } from "./editRoutineFixtures.ts";
import { payloadOf } from "./testing.ts";
import { sessionRow } from "./trainingFixtures.ts";
import { structuredOf } from "./writeFixtures.ts";

import type { ExecutionResult } from "../executor.ts";

type World = ReturnType<typeof routineWorld>;

const edit = (changes: object[], routineId: string = ids.routine) => ({
  routine_id: routineId,
  changes,
});

const run = (world: World, changes: object[]) =>
  executeTool(world.ctx, "edit_routine", edit(changes));

const draftNow = async (world: World) => {
  const stored = await getRoutine(world.ctx.caller, ids.routine);
  assert(stored !== null);
  return draftOfStoredRoutine(stored);
};

// Makes the call and keeps what the turn loop keeps beside its card, so a later Undo can read it.
async function editAndKeep(world: World, changes: object[]) {
  const result = await run(world, changes);
  assert(result.status === "ok" && result.actionId !== null);
  const { undo } = structuredOf(result);
  assert(isRecord(undo));
  // As the turn loop stores it, through JSON.
  const stored = JSON.parse(JSON.stringify(undo));
  world.store.previousValues.set(result.actionId, {
    previous: stored.previous ?? null,
    fingerprint: stored.fingerprint ?? null,
  });
  return { result, actionId: result.actionId };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const cardOf = (result: ExecutionResult) => {
  const { card } = structuredOf(result);
  assert(isRecord(card));
  return card;
};

const rowsOf = (result: ExecutionResult): string[][] => {
  const { rows } = cardOf(result);
  assert(Array.isArray(rows));
  return rows.map((row: unknown) => {
    assert(isRecord(row));
    return [String(row["name"]), String(row["amountText"])];
  });
};

const daysOf = (world: World) => {
  const days = world.routine()["routine_days"];
  assert(Array.isArray(days));
  return days as Record<string, unknown>[];
};

const savedExercises = (world: World, dayNumber: number) => {
  const exercises = world.saves.at(-1)?.days[dayNumber]?.["exercises"];
  assert(Array.isArray(exercises));
  return exercises.map((exercise: Record<string, unknown>) => [
    exercise["exercise_id"],
    exercise["target_sets"],
    exercise["rep_min"],
    exercise["rep_max"],
    exercise["target_rir"],
  ]);
};

const boardChanges = [
  change({
    op: "add",
    day_id: ids.legs,
    exercise_id: ids.legExtension,
    sets: 3,
    rep_min: 12,
    rep_max: 15,
    target_rir: 1,
  }),
  change({
    op: "swap",
    day_id: ids.legs,
    exercise_id: ids.legPress,
    new_exercise_id: ids.hackSquat,
  }),
  change({ op: "remove", day_id: ids.legs, exercise_id: ids.seatedLegCurl }),
  change({ op: "set_targets", day_id: ids.legs, exercise_id: ids.barbellSquat, sets: 4 }),
];

const withNumbers = { sets: 3, rep_min: 8, rep_max: 12, target_rir: 2 };

Deno.test(
  "edit_routine is a destructive training write that is not strict and refuses a live workout",
  () => {
    assertEquals(editRoutineTool.kind, "write");
    assertEquals(editRoutineTool.strict, false);
    assertEquals(editRoutineTool.targetTable, "routines");
    assertEquals(editRoutineTool.refusesDuringWorkout, true);
    assertEquals(editRoutineTool.annotations, { readOnlyHint: false, destructiveHint: true });
  },
);

Deno.test(
  "the description says a null keeps a number, how a RIR is cleared, that a weekday cannot be, and what to say in a workout",
  () => {
    const { description } = editRoutineTool;
    assertStringIncludes(description, "a null keeps that number");
    assertStringIncludes(description, "cannot clear a RIR");
    assertStringIncludes(description, "remove the exercise and then add it again");
    assertStringIncludes(description, "at the old position");
    assertStringIncludes(description, "update_day cannot clear a weekday");
    assertStringIncludes(description, "routine editor");
    assertStringIncludes(description, "workout_in_progress");
    assertStringIncludes(description, "finish or discard it on the Train tab");
  },
);

Deno.test("the schema asks for the routine and the changes, with the confirmation id", () => {
  const schema = toJsonSchema(editRoutineTool);

  assertEquals(schema["required"], ["routine_id", "changes", "confirmation_id"]);
});

Deno.test(
  "the board's four changes make one card with four rows, one slot and one Undo",
  async () => {
    const world = routineWorld();

    const result = await run(world, boardChanges);

    assertEquals(result.status, "ok");
    assertEquals(world.store.actions.length, 1);
    const card = cardOf(result);
    assertEquals(card["kind"], "routine_updated");
    assertEquals(card["title"], "Updated routine Push Pull Legs");
    assertEquals(card["sub"], "Legs · 4 changes");
    assertEquals(card["changeDetail"], "4 changes");
    assertEquals(card["undoneSub"], "Put Push Pull Legs back as it was");
    assertEquals(card["link"], {
      label: "Open in routine editor",
      target: { screen: "routine_editor", routineId: ids.routine },
    });
    assertEquals(rowsOf(result), [
      ["Added Leg extension", "Legs · 3 sets, 12 to 15 reps, RIR 1"],
      ["Swapped Leg press for Hack squat", "Legs · 3 sets, 10 to 12 reps, RIR 1"],
      ["Removed Seated leg curl", "Legs"],
      ["Changed Barbell squat", "Legs · 4 sets, was 3 · 5 to 8 reps, RIR 2"],
    ]);
  },
);

Deno.test(
  "the call saves the whole routine with the changes laid over it, and keeps the days' ids",
  async () => {
    const world = routineWorld();

    await run(world, boardChanges);

    assertEquals(world.saves.length, 1);
    assertEquals(
      world.saves[0]?.days.map((day) => day["id"]),
      [ids.push, ids.legs],
    );
    assertEquals(savedExercises(world, 1), [
      [ids.barbellSquat, 4, 5, 8, 2],
      [ids.hackSquat, 3, 10, 12, 1],
      [ids.legExtension, 3, 12, 15, 1],
    ]);
  },
);

Deno.test(
  "what the model reads holds a count and no name, id or number of the routine",
  async () => {
    const world = routineWorld();

    const result = await run(world, boardChanges);

    assertEquals(payloadOf(result), { updated: true, change_count: 4 });
    for (const secret of ["Leg press", "Barbell squat", "Push Pull Legs", ids.legPress]) {
      assertFalse(result.text.includes(secret));
    }
  },
);

Deno.test("the action's target is the routine", async () => {
  const world = routineWorld();

  await run(world, boardChanges);

  assertEquals(world.store.actions[0]?.targetId, ids.routine);
  assertEquals(world.store.actions[0]?.targetTable, "routines");
});

Deno.test(
  "structured holds the undo, the draft before and the fingerprint after, on every success",
  async () => {
    const world = routineWorld();
    const before = await draftNow(world);

    const result = await run(world, boardChanges);

    assertEquals(structuredOf(result)["undo"], {
      previous: JSON.parse(JSON.stringify(before)),
      fingerprint: routineFingerprint(await draftNow(world)),
    });
  },
);

Deno.test(
  "an added exercise with no numbers takes the preset of the goal, as the core function gives it",
  async () => {
    const world = routineWorld();
    const preset = exerciseTargetFor(
      { goal: "hybrid", experience: "intermediate", mechanic: "isolation" },
      GOAL_PRESETS_V1,
    );

    const result = await run(world, [
      change({ op: "add", day_id: ids.legs, exercise_id: ids.legExtension }),
    ]);

    assertEquals(savedExercises(world, 1).at(-1), [
      ids.legExtension,
      preset.sets,
      preset.repMin,
      preset.repMax,
      preset.targetRir,
    ]);
    assertEquals(
      rowsOf(result)[0]?.[1],
      `Legs · ${preset.sets} sets, ${preset.repMin} to ${preset.repMax} reps, RIR ${preset.targetRir}`,
    );
  },
);

Deno.test(
  "an added exercise takes the number the person said and the preset for the others",
  async () => {
    const world = routineWorld();
    const preset = exerciseTargetFor(
      { goal: "hybrid", experience: "intermediate", mechanic: "isolation" },
      GOAL_PRESETS_V1,
    );

    await run(world, [
      change({ op: "add", day_id: ids.legs, exercise_id: ids.legExtension, sets: 5 }),
    ]);

    assertEquals(savedExercises(world, 1).at(-1), [
      ids.legExtension,
      5,
      preset.repMin,
      preset.repMax,
      preset.targetRir,
    ]);
  },
);

Deno.test(
  "an added exercise with no numbers and no goal answers invalid_input and writes nothing",
  async () => {
    const world = routineWorld({ noGoals: true });

    const result = await run(world, [
      change({ op: "add", day_id: ids.legs, exercise_id: ids.legExtension }),
    ]);

    assertEquals(payloadOf(result), {
      error: "invalid_input",
      problems: [{ index: 0, rule: "numbers_need_goals" }],
    });
    assertEquals(world.saves.length, 0);
    assertEquals(world.store.actions.length, 0);
  },
);

Deno.test("an added exercise goes where position says", async () => {
  const world = routineWorld();

  await run(world, [
    change({
      op: "add",
      day_id: ids.legs,
      exercise_id: ids.legExtension,
      position: 0,
      ...withNumbers,
    }),
  ]);

  assertEquals(savedExercises(world, 1)[0]?.[0], ids.legExtension);
});

Deno.test("a swap keeps the old exercise's sets, reps and RIR", async () => {
  const world = routineWorld();

  await run(world, [
    change({
      op: "swap",
      day_id: ids.legs,
      exercise_id: ids.legPress,
      new_exercise_id: ids.hackSquat,
    }),
  ]);

  assertEquals(savedExercises(world, 1)[1], [ids.hackSquat, 3, 10, 12, 1]);
});

Deno.test("set_targets keeps a number that is null and says what changed", async () => {
  const world = routineWorld();

  const result = await run(world, [
    change({ op: "set_targets", day_id: ids.legs, exercise_id: ids.barbellSquat, rep_max: 6 }),
  ]);

  assertEquals(savedExercises(world, 1)[0], [ids.barbellSquat, 3, 5, 6, 2]);
  assertEquals(rowsOf(result), [
    ["Changed Barbell squat", "Legs · 3 sets · 5 to 6 reps, was 5 to 8, RIR 2"],
  ]);
});

Deno.test("set_targets with only a null RIR changes nothing, because a null keeps it", async () => {
  const world = routineWorld();

  const result = await run(world, [
    change({
      op: "set_targets",
      day_id: ids.legs,
      exercise_id: ids.barbellSquat,
      target_rir: null,
      sets: 3,
    }),
  ]);

  assertEquals(payloadOf(result), { changed: false });
  assertEquals(world.saves.length, 0);
});

Deno.test(
  "a remove then an add at the old position keeps the exercise in its place with new numbers",
  async () => {
    const world = routineWorld();

    await run(world, [
      change({ op: "remove", day_id: ids.legs, exercise_id: ids.legPress }),
      change({
        op: "add",
        day_id: ids.legs,
        exercise_id: ids.legPress,
        position: 1,
        sets: 3,
        rep_min: 10,
        rep_max: 12,
        target_rir: 0,
      }),
    ]);

    assertEquals(savedExercises(world, 1)[1], [ids.legPress, 3, 10, 12, 0]);
  },
);

Deno.test(
  "a day added, renamed and moved shows the board's three rows and '3 changes to days'",
  async () => {
    const world = routineWorld();

    const result = await run(world, [
      change({ op: "add_day", day_ref: "arms", name: "Arms", weekday: 5 }),
      change({ op: "update_day", day_id: ids.push, name: "Chest and shoulders" }),
      change({ op: "update_day", day_id: ids.legs, weekday: 4 }),
    ]);

    assertEquals(result.status, "ok");
    const card = cardOf(result);
    assertEquals(card["sub"], "3 changes to days");
    assertEquals(card["changeDetail"], "3 changes");
    assertEquals(rowsOf(result), [
      ["Added day Arms", "Saturday · no exercises yet"],
      ["Renamed Push to Chest and shoulders", "Monday"],
      ["Moved Legs to Friday", "Was Thursday"],
    ]);
    assertEquals(
      (world.saves[0]?.days ?? []).map((day) => [day["id"], day["name"], day["weekday"]]),
      [
        [ids.push, "Chest and shoulders", 0],
        [ids.legs, "Legs", 4],
        [null, "Arms", 5],
      ],
    );
  },
);

Deno.test("an exercise added to a day the same call adds is found by the day_ref", async () => {
  const world = routineWorld();

  const result = await run(world, [
    change({ op: "add_day", day_ref: "arms", name: "Arms", weekday: 5 }),
    change({
      op: "add",
      day_id: "arms",
      exercise_id: ids.legExtension,
      sets: 3,
      rep_min: 10,
      rep_max: 12,
      target_rir: 2,
    }),
  ]);

  assertEquals(result.status, "ok");
  assertEquals(rowsOf(result), [
    ["Added day Arms", "Saturday"],
    ["Added Leg extension", "Arms · 3 sets, 10 to 12 reps, RIR 2"],
  ]);
});

Deno.test(
  "removing a day changes nothing, keeps no slot, and answers with the reason and the link",
  async () => {
    const world = routineWorld();

    const result = await run(world, [change({ op: "remove_day", day_id: ids.legs })]);

    assert(result.status === "ok");
    assertEquals(payloadOf(result), { changed: false, reason: REMOVE_DAY_REFUSAL });
    assertEquals(structuredOf(result), {
      link: {
        label: "Open in routine editor",
        target: { screen: "routine_editor", routineId: ids.routine },
      },
    });
    assertEquals(result.actionId, null);
    assertEquals(world.saves.length, 0);
    assertEquals(world.store.actions.length, 0);
  },
);

Deno.test("a call that asks for a day to go applies none of its other changes", async () => {
  const world = routineWorld();

  const result = await run(world, [
    change({ op: "remove", day_id: ids.legs, exercise_id: ids.legPress }),
    change({ op: "remove_day", day_id: ids.push }),
  ]);

  assertEquals(payloadOf(result), { changed: false, reason: REMOVE_DAY_REFUSAL });
  assertEquals(world.saves.length, 0);
});

Deno.test("one removal asks nothing and has Undo", async () => {
  const world = routineWorld();

  const result = await run(world, [
    change({ op: "remove", day_id: ids.legs, exercise_id: ids.seatedLegCurl }),
  ]);

  assertEquals(result.status, "ok");
  assertEquals(rowsOf(result), [["Removed Seated leg curl", "Legs"]]);
  assertEquals(cardOf(result)["sub"], "Legs · 1 change");
  assertEquals(structuredOf(result)["undo"] === undefined, false);
});

Deno.test("adding, swapping, changing numbers and changing days ask nothing", async () => {
  const world = routineWorld();

  const result = await run(world, [
    ...boardChanges.filter((each) => each.op !== "remove"),
    change({ op: "update_day", day_id: ids.push, name: "Chest" }),
  ]);

  assertEquals(result.status, "ok");
});

const removeTwo = [
  change({ op: "remove", day_id: ids.legs, exercise_id: ids.legPress }),
  change({ op: "remove", day_id: ids.legs, exercise_id: ids.seatedLegCurl }),
];

Deno.test(
  "two removals ask first with the board's question and buttons, and write nothing",
  async () => {
    const world = routineWorld();

    const result = await executeTool(world.asking, "edit_routine", edit(removeTwo));

    assert(result.status === "needs_confirmation");
    assertEquals(
      result.question,
      "Remove 2 exercises from Legs in Push Pull Legs? Leg press and Seated leg curl. Sessions you logged keep them.",
    );
    assertEquals(world.saves.length, 0);
    assertEquals(world.store.actions.length, 0);
    assertEquals(world.store.turns[0]?.pending?.confirmLabel, "Remove 2");
  },
);

Deno.test("the button's words make the two removals, with one slot and one card", async () => {
  const world = routineWorld();
  const asked = await executeTool(world.asking, "edit_routine", edit(removeTwo));
  assert(asked.status === "needs_confirmation");

  const result = await executeTool(world.confirming("Remove 2"), "edit_routine", {
    ...edit(removeTwo),
    confirmation_id: asked.confirmationId,
  });

  assertEquals(result.status, "ok");
  assertEquals(rowsOf(result), [
    ["Removed Leg press", "Legs"],
    ["Removed Seated leg curl", "Legs"],
  ]);
  assertEquals(savedExercises(world, 1), [[ids.barbellSquat, 3, 5, 8, 2]]);
  assertEquals(world.store.actions.length, 1);
});

Deno.test("'Keep them' writes nothing and asks again, taking no slot", async () => {
  const world = routineWorld();
  const asked = await executeTool(world.asking, "edit_routine", edit(removeTwo));
  assert(asked.status === "needs_confirmation");

  const result = await executeTool(world.confirming("Keep them"), "edit_routine", {
    ...edit(removeTwo),
    confirmation_id: asked.confirmationId,
  });

  assertEquals(result.status, "needs_confirmation");
  assertEquals(world.saves.length, 0);
  assertEquals(world.store.actions.length, 0);
});

Deno.test("removals across days name the routine and not a day", async () => {
  const world = routineWorld();

  const result = await executeTool(
    world.asking,
    "edit_routine",
    edit([
      change({ op: "remove", day_id: ids.legs, exercise_id: ids.legPress }),
      change({ op: "remove", day_id: ids.push, exercise_id: ids.benchPress }),
    ]),
  );

  assert(result.status === "needs_confirmation");
  assertEquals(
    result.question,
    "Remove 2 exercises from Push Pull Legs? Leg press and Barbell bench press. Sessions you logged keep them.",
  );
});

Deno.test("two removals that cannot be made ask nothing and answer the refusal", async () => {
  const world = routineWorld();

  const result = await executeTool(
    world.asking,
    "edit_routine",
    edit([
      change({ op: "remove", day_id: ids.legs, exercise_id: ids.legPress }),
      change({ op: "remove", day_id: ids.legs, exercise_id: ids.hackSquat }),
    ]),
  );

  assertEquals(result.status, "ok");
  assertEquals(payloadOf(result), {
    error: "invalid_input",
    problems: [{ index: 1, rule: "exercise_not_found" }],
  });
});

Deno.test(
  "an exercise that does not exist is refused with the change's place and the rule, and no value",
  async () => {
    const world = routineWorld();
    const unknown = "00000000-0000-4000-8000-00000000ffff";

    const result = await run(world, [
      change({ op: "add", day_id: ids.legs, exercise_id: unknown, ...withNumbers }),
    ]);

    assertEquals(payloadOf(result), {
      error: "invalid_input",
      problems: [{ index: 0, rule: "exercise_unavailable" }],
    });
    assertFalse(result.text.includes(unknown));
    assertEquals(world.saves.length, 0);
  },
);

Deno.test("an archived exercise is refused for an add and for a swap", async () => {
  const world = routineWorld();

  const added = await run(world, [
    change({ op: "add", day_id: ids.legs, exercise_id: ids.archived, ...withNumbers }),
  ]);
  const swapped = await run(world, [
    change({
      op: "swap",
      day_id: ids.legs,
      exercise_id: ids.legPress,
      new_exercise_id: ids.archived,
    }),
  ]);

  const problems = [{ index: 0, rule: "exercise_unavailable" }];
  assertEquals(payloadOf(added), { error: "invalid_input", problems });
  assertEquals(payloadOf(swapped), { error: "invalid_input", problems });
  assertEquals(world.saves.length, 0);
});

Deno.test("a rule of the routine is blamed on the change, with no name or number", async () => {
  const world = routineWorld();

  const result = await run(world, [
    change({ op: "set_targets", day_id: ids.legs, exercise_id: ids.barbellSquat, sets: 99 }),
  ]);

  const { problems } = payloadOf(result) as { problems: { index: number; rule: string }[] };
  assertEquals(problems.length, 1);
  assertEquals(problems[0]?.index, 0);
  assertFalse(result.text.includes("99"));
  assertEquals(world.saves.length, 0);
});

Deno.test(
  "a change missing the field its op needs is refused by the field, before anything is read",
  async () => {
    const world = routineWorld();

    const result = await run(world, [
      change({ op: "swap", day_id: ids.legs, exercise_id: ids.legPress }),
    ]);

    assertEquals(result.status, "error");
    assertStringIncludes(result.text, "changes.0.new_exercise_id");
    assertEquals(world.calls.length, 0);
  },
);

Deno.test("11 changes are refused", async () => {
  const world = routineWorld();

  const result = await run(
    world,
    Array.from({ length: 11 }, () => change({ op: "update_day", day_id: ids.push, name: "Push" })),
  );

  assertEquals(result.status, "error");
});

Deno.test(
  "a routine that is not the caller's is not found, as another user's id reads",
  async () => {
    const world = routineWorld({ routines: [] });

    const result = await run(world, boardChanges);

    assertEquals(payloadOf(result), { error: "not_found" });
    assertEquals(world.saves.length, 0);
    assertEquals(world.store.actions.length, 0);
  },
);

Deno.test("a call that changes nothing keeps no slot and answers changed false", async () => {
  const world = routineWorld();

  const result = await run(world, [
    change({
      op: "swap",
      day_id: ids.legs,
      exercise_id: ids.legPress,
      new_exercise_id: ids.legPress,
    }),
  ]);

  assertEquals(payloadOf(result), { changed: false });
  assertEquals(world.saves.length, 0);
  assertEquals(world.store.actions.length, 0);
});

Deno.test(
  "a workout in progress refuses the call before any read of the routine, with no slot and no write",
  async () => {
    const world = routineWorld({ workoutInProgress: true });

    const result = await run(world, boardChanges);

    assert(result.status === "error");
    assertEquals(result.code, "workout_in_progress");
    assertEquals(world.saves.length, 0);
    assertEquals(world.store.actions.length, 0);
    assertFalse(world.calls.some((call) => call.table === "routines"));
  },
);

Deno.test(
  "a workout in progress refuses the confirm press too, leaving the confirmation unspent",
  async () => {
    const world = routineWorld();
    const asked = await executeTool(world.asking, "edit_routine", edit(removeTwo));
    assert(asked.status === "needs_confirmation");
    world.tables["workout_sessions"]?.push(sessionRow(1, { ended_at: null }));

    const result = await executeTool(world.confirming("Remove 2"), "edit_routine", {
      ...edit(removeTwo),
      confirmation_id: asked.confirmationId,
    });

    assert(result.status === "error");
    assertEquals(result.code, "workout_in_progress");
    assertEquals(world.store.actions.length, 0);
    assertEquals(world.store.turns[0]?.pending?.confirmLabel, "Remove 2");
  },
);

Deno.test(
  "Undo puts the draft back with every day's id kept, and leaves the routine active",
  async () => {
    const world = routineWorld();
    const before = await draftNow(world);
    const { actionId } = await editAndKeep(world, [
      ...boardChanges,
      change({ op: "update_day", day_id: ids.push, name: "Chest" }),
    ]);

    const outcome = await undoAction(world.ctx, actionId);

    assertEquals(outcome, { status: "undone", actionId });
    assertEquals(world.saves.length, 2);
    assertEquals(
      world.saves[1]?.days.map((day) => day["id"]),
      [ids.push, ids.legs],
    );
    assertEquals(await draftNow(world), before);
    assertEquals(world.routine()["is_active"], true);
    assertEquals(world.routine()["is_archived"], false);
  },
);

Deno.test("Undo after a change in the app answers changed and writes nothing", async () => {
  const world = routineWorld();
  const { actionId } = await editAndKeep(world, boardChanges);
  const [first] = daysOf(world);
  assert(first !== undefined);
  first["name"] = "Upper";

  const outcome = await undoAction(world.ctx, actionId);

  assertEquals(outcome, { status: "error", code: "undo_unavailable", reason: "changed" });
  assertEquals(world.saves.length, 1);
  assertEquals(world.store.actions[0]?.undoneAt, null);
});

Deno.test("Undo after a day was deleted and rebuilt in the app answers changed", async () => {
  const world = routineWorld();
  const { actionId } = await editAndKeep(world, boardChanges);
  const [first] = daysOf(world);
  assert(first !== undefined);
  first["id"] = dayId(77);

  const outcome = await undoAction(world.ctx, actionId);

  assertEquals(outcome, { status: "error", code: "undo_unavailable", reason: "changed" });
  assertEquals(world.saves.length, 1);
});

Deno.test(
  "Undo of an added day that a workout was logged from answers logged and writes nothing",
  async () => {
    const world = routineWorld();
    const { actionId } = await editAndKeep(world, [
      change({ op: "add_day", day_ref: "arms", name: "Arms", weekday: 5 }),
    ]);
    const addedId = daysOf(world).at(-1)?.["id"];
    assert(typeof addedId === "string");
    world.tables["workout_sessions"]?.push(sessionRow(10, { routine_day_id: addedId }));

    const outcome = await undoAction(world.ctx, actionId);

    assertEquals(outcome, { status: "error", code: "undo_unavailable", reason: "logged" });
    assertEquals(world.saves.length, 1);
  },
);

Deno.test("Undo of an added day that no workout was logged from removes the day", async () => {
  const world = routineWorld();
  const { actionId } = await editAndKeep(world, [
    change({ op: "add_day", day_ref: "arms", name: "Arms", weekday: 5 }),
  ]);

  const outcome = await undoAction(world.ctx, actionId);

  assertEquals(outcome, { status: "undone", actionId });
  assertEquals(daysOf(world).length, 2);
});

Deno.test("Undo in a live workout answers workout_in_progress and claims nothing", async () => {
  const world = routineWorld();
  const { actionId } = await editAndKeep(world, boardChanges);
  world.tables["workout_sessions"]?.push(sessionRow(1, { ended_at: null }));

  const outcome = await undoAction(world.ctx, actionId);

  assertEquals(outcome, {
    status: "error",
    code: "undo_unavailable",
    reason: "workout_in_progress",
  });
  assertEquals(world.saves.length, 1);
  assertEquals(world.store.actions[0]?.undoneAt, null);
});

Deno.test("Undo with no stored value answers unavailable and writes nothing", async () => {
  const world = routineWorld();
  const result = await run(world, boardChanges);
  assert(result.status === "ok" && result.actionId !== null);

  const outcome = await undoAction(world.ctx, result.actionId);

  assertEquals(outcome, { status: "error", code: "undo_unavailable" });
  assertEquals(world.saves.length, 1);
});

Deno.test("Undo twice restores once", async () => {
  const world = routineWorld();
  const { actionId } = await editAndKeep(world, boardChanges);

  await undoAction(world.ctx, actionId);
  const second = await undoAction(world.ctx, actionId);

  assertEquals(second, { status: "error", code: "already_undone" });
  assertEquals(world.saves.length, 2);
});

Deno.test("a failed save answers tool_failed, releases the slot, and leaks no name", async () => {
  const world = routineWorld();
  const failing = {
    ...world.ctx,
    caller: new Proxy(world.ctx.caller, {
      get: (target, key) =>
        key === "rpc"
          ? () =>
              Promise.resolve({ data: null, error: { code: "XX000", message: "Barbell squat" } })
          : Reflect.get(target, key),
    }),
  };

  const result = await executeTool(failing, "edit_routine", edit(boardChanges));

  assert(result.status === "error");
  assertEquals(result.code, "tool_failed");
  assertEquals(world.store.actions.length, 0);
  assertFalse(result.text.includes("squat"));
  assertFalse(world.reported.some(({ caught }) => String(caught).includes("Barbell squat")));
});
