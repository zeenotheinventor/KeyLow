import {
  assert,
  assertEquals,
  assertFalse,
  assertObjectMatch,
  assertStringIncludes,
} from "@std/assert";

import { confirmWordsFor } from "../../../assistant/confirmWords.ts";
import { executeTool } from "../executor.ts";
import {
  createFakeActionStore,
  createFakeContext,
  spyOnConsole,
  turnsOfConversation,
} from "../testing.ts";
import { undoAction } from "../undo.ts";
import { archiveCustomExerciseTool } from "./archiveCustomExercise.ts";
import {
  cableCrunch,
  libraryPress,
  missingExerciseId,
  saveExerciseRpc,
  theirsCrunch,
} from "./customExerciseFixtures.ts";
import { payloadOf, stubCaller } from "./testing.ts";
import { sessionRow } from "./trainingFixtures.ts";
import { structuredOf } from "./writeFixtures.ts";
import { writeStub } from "./writeStub.ts";

import type { ToolContext } from "../tool.ts";

const earlier = "00000000-0000-4000-8000-0000000000d1";
const later = "00000000-0000-4000-8000-0000000000d2";
const userId = "00000000-0000-4000-8000-0000000000a1";
const cableCrunchId = String(cableCrunch["id"]);

// The earlier turn is where the model asks and the later one where the user has said yes.
function archiveContexts(rows: Record<string, Record<string, unknown>[]> = {}) {
  const stub = writeStub(
    { exercises: [cableCrunch, theirsCrunch, libraryPress], ...rows },
    { callerUserId: userId, rpc: { save_exercise: saveExerciseRpc } },
  );
  const store = createFakeActionStore({ turns: turnsOfConversation([earlier, later]) });
  const contextOn = (turnId: string, personsWords = "Archive exercise"): ToolContext => ({
    ...createFakeContext([archiveCustomExerciseTool], {
      store,
      personsWords,
      turn: { id: turnId, conversationId: store.turns[0]?.conversationId ?? "" },
    }).ctx,
    caller: stub.caller,
  });
  return { stub, store, contextOn, asking: contextOn(earlier), confirming: contextOn(later) };
}

const deletedAtOf = (stub: ReturnType<typeof archiveContexts>["stub"], id: string) =>
  stub.tables["exercises"]?.find((row) => row["id"] === id)?.["deleted_at"];

async function archived(contexts = archiveContexts(), id = cableCrunchId) {
  const asked = await executeTool(contexts.asking, "archive_custom_exercise", { id });
  assert(asked.status === "needs_confirmation");
  const result = await executeTool(contexts.confirming, "archive_custom_exercise", {
    id,
    confirmation_id: asked.confirmationId,
  });
  assert(result.status === "ok" && result.actionId !== null);
  return { ...contexts, result, actionId: result.actionId };
}

Deno.test("archiving asks first, in the ticket's words, and writes nothing", async () => {
  const { asking, stub, store } = archiveContexts();

  const result = await executeTool(asking, "archive_custom_exercise", { id: cableCrunchId });

  assert(result.status === "needs_confirmation");
  assertEquals(
    result.question,
    "Archive Cable crunch? It leaves your exercise list. Sets you logged with it stay in your history.",
  );
  assertEquals(deletedAtOf(stub, cableCrunchId), null);
  assertEquals(store.actions.length, 0);
  assertEquals(store.turns[0]?.pending?.confirmLabel, "Archive exercise");
});

Deno.test("the confirmed call archives the exercise and builds the card", async () => {
  const { stub, store, result } = await archived();

  assertEquals(payloadOf(result), { id: cableCrunchId, archived: true, changed: true });
  assertEquals(typeof deletedAtOf(stub, cableCrunchId), "string");
  assertObjectMatch(structuredOf(result), {
    card: {
      kind: "exercise_archived",
      title: "Archived exercise Cable crunch",
      sub: "Sets you logged with it stay in your history",
      link: null,
      undo: "available",
      undoneSub: "Cable crunch is back in your exercises",
    },
  });
  const [action] = store.actions;
  assertEquals(action?.tool, "archive_custom_exercise");
  assertEquals(action?.targetTable, "exercises");
  assertEquals(action?.targetId, cableCrunchId);
});

Deno.test("an archive stores no previous value, because its Undo needs none", async () => {
  const { result } = await archived();

  assertEquals(Object.keys(structuredOf(result)), ["card"]);
});

Deno.test("after Keep it the confirmation asks again and nothing is archived", async () => {
  const { asking, contextOn, stub, store } = archiveContexts();
  const asked = await executeTool(asking, "archive_custom_exercise", { id: cableCrunchId });
  assert(asked.status === "needs_confirmation");

  const result = await executeTool(contextOn(later, "Keep it"), "archive_custom_exercise", {
    id: cableCrunchId,
    confirmation_id: asked.confirmationId,
  });

  assertObjectMatch(result, { status: "needs_confirmation", asksAgain: true });
  assertEquals(deletedAtOf(stub, cableCrunchId), null);
  assertEquals(store.actions.length, 0);
});

Deno.test("a library exercise is refused with no question and no write", async () => {
  const { asking, stub, store } = archiveContexts();

  const result = await executeTool(asking, "archive_custom_exercise", {
    id: String(libraryPress["id"]),
  });

  assertEquals(result.status, "ok");
  assertEquals(payloadOf(result), { error: "global_exercise" });
  assertEquals(deletedAtOf(stub, String(libraryPress["id"])), null);
  assertEquals(store.actions.length, 0);
  assertEquals(store.turns[0]?.pending, null);
});

Deno.test(
  "another user's exercise, and one that does not exist, are not found with no question",
  async () => {
    const { asking, stub, store } = archiveContexts();

    for (const id of [String(theirsCrunch["id"]), missingExerciseId]) {
      const result = await executeTool(asking, "archive_custom_exercise", { id });

      assertEquals(result.status, "ok");
      assertEquals(payloadOf(result), { error: "not_found" });
    }
    assertEquals(deletedAtOf(stub, String(theirsCrunch["id"])), null);
    assertEquals(store.actions.length, 0);
    assertEquals(store.turns[0]?.pending, null);
  },
);

Deno.test(
  "an exercise that is archived already is answered plainly, with no question and no action",
  async () => {
    const { asking, store } = archiveContexts({
      exercises: [{ ...cableCrunch, deleted_at: "2026-11-05T10:00:00+00:00" }],
    });

    const result = await executeTool(asking, "archive_custom_exercise", { id: cableCrunchId });

    assertEquals(payloadOf(result), { id: cableCrunchId, archived: true, changed: false });
    assertEquals(structuredOf(result), {});
    assertEquals(store.actions.length, 0);
    assertEquals(store.turns[0]?.pending, null);
  },
);

Deno.test("Undo restores the exercise, and a second Undo is already_undone", async () => {
  const { confirming, stub, actionId } = await archived();

  const first = await undoAction(confirming, actionId);
  const second = await undoAction(confirming, actionId);

  assertEquals(first, { status: "undone", actionId });
  assertEquals(second, { status: "error", code: "already_undone" });
  assertEquals(deletedAtOf(stub, cableCrunchId), null);
});

Deno.test(
  "Undo reads no stored value, so it still works once the conversation is deleted",
  async () => {
    const { confirming, store, stub, actionId } = await archived();
    // Deleting the conversation deletes what was stored beside its cards. This tool stored nothing.
    store.previousValues.clear();

    const result = await undoAction(confirming, actionId);

    assertEquals(result, { status: "undone", actionId });
    assertEquals(store.calls["previousValueOf"], undefined);
    assertEquals(deletedAtOf(stub, cableCrunchId), null);
  },
);

Deno.test("Undo is unavailable when the exercise is already live", async () => {
  const { confirming, stub, actionId } = await archived();
  Object.assign(stub.tables["exercises"]?.find((row) => row["id"] === cableCrunchId) ?? {}, {
    deleted_at: null,
  });

  const result = await undoAction(confirming, actionId);

  assertEquals(result, { status: "error", code: "undo_unavailable" });
});

Deno.test("another user's exercise in an action cannot be restored by this user", async () => {
  const { confirming, stub, store } = archiveContexts({
    exercises: [{ ...theirsCrunch, deleted_at: "2026-11-05T10:00:00+00:00" }],
  });
  store.actions.push({
    id: "action-theirs",
    userId,
    conversationId: confirming.turn.conversationId,
    turnId: later,
    turnSeq: 1,
    tool: "archive_custom_exercise",
    targetTable: "exercises",
    targetId: String(theirsCrunch["id"]),
    targetIds: null,
    targetLocalDate: null,
    targetUpdatedAt: null,
    undoneAt: null,
  });

  const result = await undoAction(confirming, "action-theirs");

  assertEquals(result, { status: "error", code: "undo_unavailable" });
  assertEquals(typeof deletedAtOf(stub, String(theirsCrunch["id"])), "string");
});

Deno.test("a live workout refuses the archive, its question and its Undo", async () => {
  const { asking, confirming, actionId } = await archived();
  const duringWorkout = (ctx: ToolContext): ToolContext => ({
    ...ctx,
    caller: stubCaller({ tables: { workout_sessions: [sessionRow(1, { ended_at: null })] } })
      .caller,
  });

  const refused = await executeTool(duringWorkout(asking), "archive_custom_exercise", {
    id: cableCrunchId,
  });
  const undone = await undoAction(duringWorkout(confirming), actionId);

  assertObjectMatch(refused, { status: "error", code: "workout_in_progress" });
  assertEquals(undone, {
    status: "error",
    code: "undo_unavailable",
    reason: "workout_in_progress",
  });
  assertEquals(archiveCustomExerciseTool.refusesDuringWorkout, true);
});

Deno.test("the buttons are the board's and the tone is primary", async () => {
  const { asking } = archiveContexts();
  const input = { id: cableCrunchId };

  const need = await archiveCustomExerciseTool.needsConfirmation?.(input, asking);

  assertEquals(confirmWordsFor("archive_custom_exercise", input), {
    confirmLabel: "Archive exercise",
    cancelLabel: "Keep it",
    tone: "primary",
  });
  assertEquals(need !== false && need !== undefined ? need.confirmLabel : null, "Archive exercise");
  assertEquals(confirmWordsFor("archive_custom_exercise", {}), null);
});

Deno.test(
  "the description tells the model to word the question, and where to bring one back",
  () => {
    const { description, annotations, strict } = archiveCustomExerciseTool;

    assertStringIncludes(
      description,
      "in the same response as the call, before it, write the question",
    );
    assertStringIncludes(description, "When they say no, do not call again.");
    assertStringIncludes(description, "What the assistant changed");
    assertFalse(description.includes("ask the user"));
    assertEquals(annotations, { readOnlyHint: false, destructiveHint: true });
    assertEquals(strict, false);
  },
);

Deno.test("nothing about the exercise is logged", async () => {
  const spy = spyOnConsole();
  try {
    const { confirming, actionId, asking } = await archived();
    await undoAction(confirming, actionId);
    await executeTool(asking, "archive_custom_exercise", { id: missingExerciseId });
  } finally {
    spy.restore();
  }

  assertEquals(spy.lines, []);
});

// What puts an exercise on a screen the person will open: a routine that is not archived, and an accepted
// suggestion that is live. A set logged with it does not, because the question says those stay in history.
const inRoutine = (archived: boolean) => ({
  routine_exercises: [
    {
      id: "re1",
      user_id: userId,
      exercise_id: cableCrunchId,
      routine_days: { routines: { is_archived: archived } },
    },
  ],
});

const acceptedWith = (overrides: Record<string, unknown> = {}) => ({
  accepted_suggestions: [
    {
      id: "as1",
      user_id: userId,
      local_date: "2026-11-03",
      deleted_at: null,
      exercises: [{ exercise_id: cableCrunchId, exercise: { id: cableCrunchId } }],
      ...overrides,
    },
  ],
});

const refusal = (reason: "routine" | "suggestion") => ({
  error: "in_use",
  say:
    reason === "routine"
      ? "Take it out of your routines first."
      : "It is in a workout you accepted on Train. Undo that first.",
});

Deno.test("an exercise on a routine that is not archived is refused with no question", async () => {
  const { asking, stub, store } = archiveContexts(inRoutine(false));

  const result = await executeTool(asking, "archive_custom_exercise", { id: cableCrunchId });

  assertEquals(result.status, "ok");
  assertEquals(payloadOf(result), refusal("routine"));
  assertEquals(deletedAtOf(stub, cableCrunchId), null);
  assertEquals(store.actions.length, 0);
  assertEquals(store.turns[0]?.pending, null);
});

Deno.test(
  "an exercise on a live accepted suggestion of today or later is refused with no question",
  async () => {
    for (const local_date of ["2026-11-03", "2026-11-09"]) {
      const { asking, store } = archiveContexts(acceptedWith({ local_date }));

      const result = await executeTool(asking, "archive_custom_exercise", { id: cableCrunchId });

      assertEquals(payloadOf(result), refusal("suggestion"));
      assertEquals(store.turns[0]?.pending, null);
    }
  },
);

Deno.test(
  "a routine that is archived, a deleted or past suggestion and logged sets do not stop the question",
  async () => {
    const blockers = [
      inRoutine(true),
      acceptedWith({ deleted_at: "2026-11-02T10:00:00+00:00" }),
      acceptedWith({ local_date: "2026-11-02" }),
      { workout_sets: [{ id: "s1", user_id: userId, exercise_id: cableCrunchId }] },
    ];
    for (const rows of blockers) {
      const { asking } = archiveContexts(rows);

      const result = await executeTool(asking, "archive_custom_exercise", { id: cableCrunchId });

      assertEquals(result.status, "needs_confirmation");
    }
  },
);

Deno.test(
  "the confirming call asks again whether it is in use, and archives nothing when it now is",
  async () => {
    const { asking, confirming, stub, store } = archiveContexts();
    const asked = await executeTool(asking, "archive_custom_exercise", { id: cableCrunchId });
    assert(asked.status === "needs_confirmation");
    // The person put it on a routine between the question and the answer.
    stub.tables["routine_exercises"] = inRoutine(false)["routine_exercises"];

    const result = await executeTool(confirming, "archive_custom_exercise", {
      id: cableCrunchId,
      confirmation_id: asked.confirmationId,
    });

    assertEquals(payloadOf(result), refusal("routine"));
    assertEquals(deletedAtOf(stub, cableCrunchId), null);
    assertEquals(store.actions.length, 0);
  },
);

Deno.test(
  "a library exercise is global_exercise before in_use, and not_found before both",
  async () => {
    const { asking } = archiveContexts({
      routine_exercises: [
        {
          id: "re2",
          user_id: userId,
          exercise_id: String(libraryPress["id"]),
          routine_days: { routines: { is_archived: false } },
        },
      ],
    });

    const library = await executeTool(asking, "archive_custom_exercise", {
      id: String(libraryPress["id"]),
    });
    const missing = await executeTool(asking, "archive_custom_exercise", { id: missingExerciseId });

    assertEquals(payloadOf(library), { error: "global_exercise" });
    assertEquals(payloadOf(missing), { error: "not_found" });
  },
);
