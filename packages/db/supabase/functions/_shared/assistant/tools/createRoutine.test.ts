import {
  assert,
  assertEquals,
  assertFalse,
  assertObjectMatch,
  assertStringIncludes,
} from "@std/assert";

import {
  GOAL_PRESETS_V1,
  buildRoutineDraft,
  exerciseTargetFor,
  routineFingerprint,
} from "../../core.ts";
import { getRoutine } from "../../repos.ts";
import { executeTool } from "../executor.ts";
import { toJsonSchema } from "../tool.ts";
import { undoAction } from "../undo.ts";
import { createRoutineTool } from "./createRoutine.ts";
import {
  archivedExerciseId,
  libraryExercise,
  otherUsersExerciseId,
  routineContext,
  unknownExerciseId,
} from "./routineFixtures.ts";
import { fingerprintOfStoredRoutine } from "./routineWrite.ts";
import { payloadOf } from "./testing.ts";
import { exerciseId, goalsRow, sessionRow } from "./trainingFixtures.ts";
import { structuredOf } from "./writeFixtures.ts";

import type { ExecutionResult } from "../executor.ts";

const setUp = (options: Parameters<typeof routineContext>[1] = {}) =>
  routineContext([createRoutineTool], options);

const ids = (from: number, count: number) =>
  Array.from({ length: count }, (_, index) => exerciseId(from + index));

// Push, Pull and Legs, five exercises each, on Monday, Wednesday and Friday.
const threeDays = {
  name: "Push Pull Legs",
  days: [
    { name: "Push", weekday: 0, exercise_ids: ids(1, 5) },
    { name: "Pull", weekday: 2, exercise_ids: ids(6, 5) },
    { name: "Legs", weekday: 4, exercise_ids: ids(11, 5) },
  ],
};

const routinesOf = (stub: ReturnType<typeof setUp>["stub"]) => stub.tables["routines"] ?? [];

const savedCalls = (stub: ReturnType<typeof setUp>["stub"]) =>
  stub.calls.filter((call) => call.table === "rpc:save_routine");

// What the turn loop does with `structured.undo`: it keeps it beside the card, keyed by the action.
function keepUndo(setup: ReturnType<typeof setUp>, result: ExecutionResult): string {
  assertEquals(result.status, "ok");
  const actionId = result.status === "ok" ? result.actionId : null;
  const undo = structuredOf(result)["undo"] as { previous: null; fingerprint: string };
  assert(actionId !== null);
  setup.store.previousValues.set(actionId, undo);
  return actionId;
}

const asRecords = (value: unknown) => value as Record<string, unknown>[];

Deno.test("a 3 day build saves, and every set, rep range and RIR is the goal's own", async () => {
  const { ctx, stub } = setUp();

  const result = await executeTool(ctx, "create_routine", threeDays);

  assertEquals(result.status, "ok");
  const [routine] = routinesOf(stub);
  const planned = asRecords(routine?.["routine_days"]).flatMap((day) =>
    asRecords(day["routine_exercises"]),
  );
  assertEquals(planned.length, 15);
  for (const row of planned) {
    const mechanic =
      Number(String(row["exercise_id"]).slice(-12)) % 2 === 0 ? "compound" : "isolation";
    const target = exerciseTargetFor(
      { goal: "hybrid", experience: "intermediate", mechanic },
      GOAL_PRESETS_V1,
    );
    assertEquals(
      [row["target_sets"], row["rep_min"], row["rep_max"], row["target_rir"]],
      [target.sets, target.repMin, target.repMax, target.targetRir],
    );
  }
});

Deno.test("the routine is saved without being active, and the model is told so", async () => {
  const { ctx, stub } = setUp();

  const result = await executeTool(ctx, "create_routine", threeDays);

  assertEquals(routinesOf(stub)[0]?.["is_active"], false);
  assertEquals(routinesOf(stub)[0]?.["is_archived"], false);
  assertObjectMatch(payloadOf(result) as Record<string, unknown>, {
    routine_id: routinesOf(stub)[0]?.["id"],
    is_active: false,
  });
});

Deno.test("the card is the board's, built from the saved routine", async () => {
  const { ctx, stub, store } = setUp();

  const result = await executeTool(ctx, "create_routine", threeDays);

  const card = structuredOf(result)["card"] as Record<string, unknown>;
  const days = asRecords(card["days"]);
  assertObjectMatch(card, {
    kind: "routine_created",
    title: "Built routine Push Pull Legs, 3 days",
    sub: "From your goal: both, intermediate",
    rows: [],
    totalText: "The week: 45 sets · 3 days",
    note: "This is not your active routine. Ask to make it active, or do it in Routines.",
    link: {
      label: "Open in routine editor",
      target: { screen: "routine_editor", routineId: routinesOf(stub)[0]?.["id"] },
    },
    undo: "available",
    undoneSub: "Archived Push Pull Legs. You can restore it from Archived in Routines.",
    changeDetail: "3 days · 45 sets a week",
  });
  assertEquals(
    days.map((day) => day["name"]),
    ["Monday · Push", "Wednesday · Pull", "Friday · Legs"],
  );
  assertEquals(days[0]?.["summary"], "5 exercises · 15 sets · about 50 min");
  assertEquals(asRecords(days[0]?.["exercises"])[0]?.["name"], "Exercise 1");
  assertEquals(store.actions.length, 1);
  assertEquals(store.actions[0]?.targetTable, "routines");
  assertEquals(store.actions[0]?.targetId, routinesOf(stub)[0]?.["id"]);
});

Deno.test("the input has no field for sets, reps or RIR, and target_sets is refused", async () => {
  const { ctx, stub } = setUp();
  const schema = JSON.stringify(toJsonSchema(createRoutineTool));

  for (const word of ["sets", "reps", "rep_min", "rep_max", "rir"]) {
    assertFalse(schema.includes(word), word);
  }
  const inDay = await executeTool(ctx, "create_routine", {
    ...threeDays,
    days: [{ ...threeDays.days[0], target_sets: 5 }],
  });
  const topLevel = await executeTool(ctx, "create_routine", { ...threeDays, target_sets: 5 });

  assertEquals(payloadOf(inDay), { error: "invalid_input", fields: ["days.0"] });
  assertEquals(payloadOf(topLevel), { error: "invalid_input", fields: [] });
  assertEquals(routinesOf(stub), []);
});

Deno.test(
  "an id the model made up, another user's exercise and an archived one are each refused",
  async () => {
    for (const badId of [unknownExerciseId, otherUsersExerciseId, archivedExerciseId]) {
      const { ctx, stub, store } = setUp();

      const result = await executeTool(ctx, "create_routine", {
        ...threeDays,
        days: [
          threeDays.days[0],
          { name: "Pull", weekday: 2, exercise_ids: [exerciseId(6), badId] },
        ],
      });

      assertEquals(payloadOf(result), {
        error: "invalid_input",
        fields: ["days.1.exercise_ids.1"],
      });
      assertEquals(routinesOf(stub), []);
      assertEquals(savedCalls(stub), []);
      assertEquals(store.actions.length, 0);
    }
  },
);

Deno.test(
  "every id is read back under the caller's JWT in one request before the save",
  async () => {
    const { ctx, stub } = setUp();

    await executeTool(ctx, "create_routine", threeDays);

    const reads = stub.calls.filter((call) => call.table === "exercises");
    assertEquals(reads.length, 1);
    assertEquals(savedCalls(stub).length, 1);
    assert(
      stub.calls.findIndex((call) => call.table === "exercises") <
        stub.calls.findIndex((call) => call.table === "rpc:save_routine"),
    );
  },
);

Deno.test("two days on one weekday are refused with the place of the second", async () => {
  const { ctx, stub } = setUp();

  const result = await executeTool(ctx, "create_routine", {
    ...threeDays,
    days: [threeDays.days[0], { ...threeDays.days[1], weekday: 0 }],
  });

  assertEquals(payloadOf(result), { error: "invalid_input", fields: ["days.1.weekday"] });
  assertEquals(routinesOf(stub), []);
});

Deno.test("an exercise twice in a day is refused", async () => {
  const { ctx, stub } = setUp();

  const result = await executeTool(ctx, "create_routine", {
    ...threeDays,
    days: [{ name: "Push", weekday: 0, exercise_ids: [exerciseId(1), exerciseId(1)] }],
  });

  assertEquals(payloadOf(result), { error: "invalid_input", fields: ["days.0.exercise_ids.1"] });
  assertEquals(routinesOf(stub), []);
});

Deno.test("with no current goal the answer is needs_goal and nothing is saved", async () => {
  const { ctx, stub, store } = setUp({ goal: null });

  const result = await executeTool(ctx, "create_routine", threeDays);

  assertEquals(payloadOf(result), { needs_goal: true });
  assertEquals(routinesOf(stub), []);
  assertEquals(savedCalls(stub), []);
  assertEquals(store.actions.length, 0);
  assertEquals(structuredOf(result), {});
});

Deno.test(
  "a day over the goal's minutes and an exercise outside its equipment are flagged, not refused",
  async () => {
    const { ctx, stub } = setUp({
      goal: goalsRow({ session_minutes: 45 }),
      rows: {
        exercises: [
          ...Array.from({ length: 6 }, (_, index) =>
            libraryExercise(index + 1, index === 1 ? { equipment: "machine" } : {}),
          ),
        ],
      },
    });

    const result = await executeTool(ctx, "create_routine", {
      name: "One day",
      days: [{ name: "Everything", weekday: null, exercise_ids: ids(1, 6) }],
    });

    assertEquals(result.status, "ok");
    assertEquals(routinesOf(stub).length, 1);
    assertObjectMatch(payloadOf(result) as Record<string, unknown>, {
      over_session_minutes: [0],
      outside_equipment: [[0, 1]],
    });
  },
);

Deno.test("a flag-free build says so with empty lists", async () => {
  const { ctx } = setUp();

  const result = await executeTool(ctx, "create_routine", threeDays);

  assertObjectMatch(payloadOf(result) as Record<string, unknown>, {
    over_session_minutes: [],
    outside_equipment: [],
  });
});

Deno.test(
  "the result never echoes the routine and stays under 2,000 characters at 7 days of 8 with plain day names",
  async () => {
    // Plain letters. A name of characters that JSON escapes takes more room, up to 5,405 characters, and nothing is cut.
    const longName = "d".repeat(100);
    const { ctx } = setUp({
      goal: goalsRow({ session_minutes: 30, equipment: ["cable"] }),
      rows: {
        exercises: Array.from({ length: 56 }, (_, index) => libraryExercise(index + 1)),
      },
    });

    const result = await executeTool(ctx, "create_routine", {
      name: "n".repeat(200),
      days: Array.from({ length: 7 }, (_, day) => ({
        name: longName,
        weekday: day,
        exercise_ids: ids(day * 8 + 1, 8),
      })),
    });

    assertEquals(result.status, "ok");
    const payload = payloadOf(result) as Record<string, unknown>;
    assertEquals(asRecords(payload["outside_equipment"]).length, 56);
    assertFalse(JSON.stringify(payload).includes("Exercise"));
    assertFalse("name" in payload);
    assert(result.text.length < 2000, `${result.text.length} characters`);
  },
);

Deno.test(
  "structured holds the undo with the fingerprint a read of the routine reproduces",
  async () => {
    const setup = setUp();

    const result = await executeTool(setup.ctx, "create_routine", threeDays);

    const undo = structuredOf(result)["undo"] as { previous: unknown; fingerprint: string };
    assertEquals(undo.previous, null);
    const stored = await getRoutine(setup.stub.caller, String(routinesOf(setup.stub)[0]?.["id"]));
    assert(stored !== null);
    assertEquals(undo.fingerprint, fingerprintOfStoredRoutine(stored));
    // And the text of the draft that was sent, whose days had no id yet.
    const draft = buildRoutineDraft(
      {
        name: threeDays.name,
        days: threeDays.days.map((day) => ({
          name: day.name,
          weekday: day.weekday,
          exerciseIds: day.exercise_ids,
        })),
      },
      new Map(
        setup.stub.tables["exercises"]?.map((row) => [
          String(row["id"]),
          { mechanic: row["mechanic"] === "compound" ? "compound" : "isolation" } as const,
        ]),
      ),
      { goal: "hybrid", experience: "intermediate" },
      GOAL_PRESETS_V1,
    );
    assert(draft.ok);
    assertEquals(undo.fingerprint, routineFingerprint(draft.draft));
  },
);

Deno.test("a live workout refuses the build and saves nothing", async () => {
  const { ctx, stub, store } = setUp({
    rows: { workout_sessions: [sessionRow(1, { ended_at: null })] },
  });

  const result = await executeTool(ctx, "create_routine", threeDays);

  assertEquals(result.status, "error");
  assertEquals(result.status === "error" ? result.code : null, "workout_in_progress");
  assertEquals(routinesOf(stub), []);
  assertEquals(store.actions.length, 0);
});

Deno.test("Undo archives the routine, and a second press is already_undone", async () => {
  const setup = setUp();
  const result = await executeTool(setup.ctx, "create_routine", threeDays);
  const actionId = keepUndo(setup, result);

  const first = await undoAction(setup.ctx, actionId);
  const second = await undoAction(setup.ctx, actionId);

  assertEquals(first, { status: "undone", actionId });
  assertEquals(second, { status: "error", code: "already_undone" });
  assertEquals(routinesOf(setup.stub)[0]?.["is_archived"], true);
});

Deno.test("Undo is unavailable as changed after the routine was edited", async () => {
  const setup = setUp();
  const result = await executeTool(setup.ctx, "create_routine", threeDays);
  const actionId = keepUndo(setup, result);
  const [firstDay] = asRecords(routinesOf(setup.stub)[0]?.["routine_days"]);
  const [firstExercise] = asRecords(firstDay?.["routine_exercises"]);
  Object.assign(firstExercise ?? {}, { target_sets: 5 });

  assertEquals(await undoAction(setup.ctx, actionId), {
    status: "error",
    code: "undo_unavailable",
    reason: "changed",
  });
  assertEquals(routinesOf(setup.stub)[0]?.["is_archived"], false);
});

Deno.test(
  "Undo is unavailable as changed after the routine was renamed or archived in the app",
  async () => {
    for (const change of [{ name: "Something else" }, { is_archived: true }]) {
      const setup = setUp();
      const result = await executeTool(setup.ctx, "create_routine", threeDays);
      const actionId = keepUndo(setup, result);
      Object.assign(routinesOf(setup.stub)[0] ?? {}, change);

      assertEquals(await undoAction(setup.ctx, actionId), {
        status: "error",
        code: "undo_unavailable",
        reason: "changed",
      });
    }
  },
);

Deno.test(
  "Undo is unavailable as active once the person chose the routine, and changes nothing",
  async () => {
    const setup = setUp();
    const result = await executeTool(setup.ctx, "create_routine", threeDays);
    const actionId = keepUndo(setup, result);
    Object.assign(routinesOf(setup.stub)[0] ?? {}, { is_active: true });

    assertEquals(await undoAction(setup.ctx, actionId), {
      status: "error",
      code: "undo_unavailable",
      reason: "active",
    });
    assertEquals(routinesOf(setup.stub)[0]?.["is_archived"], false);
    assertEquals(routinesOf(setup.stub)[0]?.["is_active"], true);
  },
);

Deno.test(
  "Undo is unavailable as logged once a workout was done from one of its days",
  async () => {
    const setup = setUp();
    const result = await executeTool(setup.ctx, "create_routine", threeDays);
    const actionId = keepUndo(setup, result);
    const [secondDay] = asRecords(routinesOf(setup.stub)[0]?.["routine_days"]).slice(1);
    (setup.stub.tables["workout_sessions"] ??= []).push(
      sessionRow(2, { routine_day_id: secondDay?.["id"] }),
    );

    assertEquals(await undoAction(setup.ctx, actionId), {
      status: "error",
      code: "undo_unavailable",
      reason: "logged",
    });
    assertEquals(routinesOf(setup.stub)[0]?.["is_archived"], false);
  },
);

Deno.test("a workout deleted since does not count as logged", async () => {
  const setup = setUp();
  const result = await executeTool(setup.ctx, "create_routine", threeDays);
  const actionId = keepUndo(setup, result);
  const [firstDay] = asRecords(routinesOf(setup.stub)[0]?.["routine_days"]);
  (setup.stub.tables["workout_sessions"] ??= []).push(
    sessionRow(2, { routine_day_id: firstDay?.["id"], deleted_at: "2026-11-03T08:00:00+00:00" }),
  );

  assertEquals((await undoAction(setup.ctx, actionId)).status, "undone");
});

Deno.test("Undo waits while a workout is in progress, and stays possible afterwards", async () => {
  const setup = setUp();
  const result = await executeTool(setup.ctx, "create_routine", threeDays);
  const actionId = keepUndo(setup, result);
  (setup.stub.tables["workout_sessions"] ??= []).push(sessionRow(3, { ended_at: null }));

  assertEquals(await undoAction(setup.ctx, actionId), {
    status: "error",
    code: "undo_unavailable",
    reason: "workout_in_progress",
  });
  setup.stub.tables["workout_sessions"] = [];
  assertEquals((await undoAction(setup.ctx, actionId)).status, "undone");
});

Deno.test(
  "Undo is unavailable as changed when the conversation was deleted and the fingerprint went with it",
  async () => {
    const setup = setUp();
    const result = await executeTool(setup.ctx, "create_routine", threeDays);
    assertEquals(result.status, "ok");
    const actionId = result.status === "ok" ? String(result.actionId) : "";

    assertEquals(await undoAction(setup.ctx, actionId), {
      status: "error",
      code: "undo_unavailable",
      reason: "changed",
    });
    assertEquals(routinesOf(setup.stub)[0]?.["is_archived"], false);
  },
);

Deno.test(
  "the fingerprint, the previous value and the exercises stay out of the model's text and the card",
  async () => {
    const { ctx } = setUp();

    const result = await executeTool(ctx, "create_routine", threeDays);

    const structured = structuredOf(result);
    const fingerprint = (structured["undo"] as { fingerprint: string }).fingerprint;
    assertFalse(result.status === "ok" && result.text.includes(fingerprint));
    assertFalse(JSON.stringify(structured["card"]).includes(fingerprint));
  },
);

Deno.test(
  "the description asks for the searches in one response and sends a no-goal user to the Goal screen",
  () => {
    const { description } = createRoutineTool;

    assertStringIncludes(description, "in one response");
    assertStringIncludes(description, "Goal screen in Train");
    assertStringIncludes(description, "Do not ask them with ask_user");
    assertStringIncludes(description, "edit_routine");
    assertStringIncludes(description, "read the routine with get_routines before edit_routine");
  },
);

Deno.test(
  "when the read-back fails after the save, the card, the result and the Undo come from the draft",
  async () => {
    const setup = setUp();
    setup.stub.failNextReadFrom("routines");

    const result = await executeTool(setup.ctx, "create_routine", threeDays);

    assertEquals(result.status, "ok");
    assertEquals(routinesOf(setup.stub).length, 1);
    const [row] = routinesOf(setup.stub);
    assertObjectMatch(payloadOf(result) as Record<string, unknown>, {
      routine_id: row?.["id"],
      is_active: false,
      sets_per_week: 45,
    });
    const days = asRecords((payloadOf(result) as Record<string, unknown>)["days"]);
    assertEquals(days.length, 3);
    assertEquals(
      days.map((day) => day["sets"]),
      [15, 15, 15],
    );
    const card = structuredOf(result)["card"] as Record<string, unknown>;
    assertEquals(
      asRecords(card["days"]).map((day) => day["name"]),
      ["Monday · Push", "Wednesday · Pull", "Friday · Legs"],
    );
    assertObjectMatch(card, {
      title: "Built routine Push Pull Legs, 3 days",
      link: { target: { screen: "routine_editor", routineId: row?.["id"] } },
    });
    // The fingerprint of the draft is the one a read of the routine gives, so Undo still works.
    const actionId = keepUndo(setup, result);
    const stored = await getRoutine(setup.stub.caller, String(row?.["id"]));
    assert(stored !== null);
    assertEquals(
      (structuredOf(result)["undo"] as { fingerprint: string }).fingerprint,
      fingerprintOfStoredRoutine(stored),
    );
    assertEquals((await undoAction(setup.ctx, actionId)).status, "undone");
    assertEquals(setup.store.actions.length, 1);
    assertEquals(setup.reported.length, 1);
  },
);

Deno.test(
  "a failed save is tool_failed with nothing landed, and the report quotes no name",
  async () => {
    const setup = setUp({
      saveRoutine: () => ({
        data: null,
        error: { code: "XX000", message: "Push Pull Legs broke" },
      }),
    });

    const result = await executeTool(setup.ctx, "create_routine", threeDays);

    assertEquals(result.status === "error" ? result.code : null, "tool_failed");
    assertEquals(routinesOf(setup.stub), []);
    assertEquals(setup.store.actions.length, 0);
    assertFalse(JSON.stringify(setup.reported.map((each) => String(each.caught))).includes("Push"));
  },
);

Deno.test("the save is one rpc call and the routine is read back once, after it", async () => {
  const { ctx, stub } = setUp();

  await executeTool(ctx, "create_routine", threeDays);

  const methods = stub.calls.map((call) => call.table);
  assertEquals(methods.filter((table) => table === "rpc:save_routine").length, 1);
  assertEquals(methods.filter((table) => table === "routines").length, 1);
  assert(methods.indexOf("rpc:save_routine") < methods.indexOf("routines"));
});

Deno.test(
  "Undo is unavailable as active when the routine became active between the read and the archive",
  async () => {
    const setup = setUp();
    const result = await executeTool(setup.ctx, "create_routine", threeDays);
    const actionId = keepUndo(setup, result);
    const [row] = routinesOf(setup.stub);
    setup.stub.beforeNextWriteTo("routines", () => {
      Object.assign(row ?? {}, { is_active: true });
    });

    assertEquals(await undoAction(setup.ctx, actionId), {
      status: "error",
      code: "undo_unavailable",
      reason: "active",
    });
    assertEquals(row?.["is_archived"], false);
    assertEquals(setup.reported, []);
  },
);

Deno.test(
  "a day exactly as long as the session minutes is not flagged, and one minute over is",
  async () => {
    // Six exercises of three sets each are 6 x 2 + 18 x 2.5 = 57 minutes, which rounds to 55.
    const flagged = async (sessionMinutes: number) => {
      const { ctx } = setUp({
        goal: goalsRow({ session_minutes: sessionMinutes }),
        rows: { exercises: Array.from({ length: 6 }, (_, index) => libraryExercise(index + 1)) },
      });
      const result = await executeTool(ctx, "create_routine", {
        name: "One day",
        days: [{ name: "Everything", weekday: null, exercise_ids: ids(1, 6) }],
      });
      return (payloadOf(result) as Record<string, unknown>)["over_session_minutes"];
    };

    assertEquals(await flagged(55), []);
    assertEquals(await flagged(54), [0]);
  },
);
