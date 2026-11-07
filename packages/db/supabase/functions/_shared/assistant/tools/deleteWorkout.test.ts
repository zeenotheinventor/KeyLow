import {
  assert,
  assertEquals,
  assertFalse,
  assertNotEquals,
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
import { deleteWorkoutTool } from "./deleteWorkout.ts";
import {
  freeId,
  liveId,
  removedEarlierId,
  removedEarlierStamp,
  stampOfDeletion,
  theirsId,
  thursdayId,
  unknownId,
  warmUpsOnlyId,
  workoutStub,
} from "./deleteWorkoutFixtures.ts";
import { payloadOf } from "./testing.ts";
import { sessionRow } from "./trainingFixtures.ts";
import { structuredOf } from "./writeFixtures.ts";

import type { WriteStub } from "./writeStub.ts";
import type { ToolContext } from "../tool.ts";

const earlier = "00000000-0000-4000-8000-0000000000d1";
const later = "00000000-0000-4000-8000-0000000000d2";

function deleteContexts(options: { live?: true } = {}) {
  const stub = workoutStub(options);
  const store = createFakeActionStore({ turns: turnsOfConversation([earlier, later]) });
  const contextOn = (turnId: string, personsWords: string): ToolContext => ({
    ...createFakeContext([deleteWorkoutTool], {
      store,
      personsWords,
      turn: { id: turnId, conversationId: store.turns[0]?.conversationId ?? "" },
    }).ctx,
    caller: stub.caller,
  });
  return {
    stub,
    store,
    asking: contextOn(earlier, "Delete my Legs workout from last Thursday"),
    confirming: contextOn(later, "Delete workout"),
    keeping: contextOn(later, "Keep it"),
    typing: contextOn(later, "yes, go on"),
  };
}

const confirmationIdOf = (result: Awaited<ReturnType<typeof executeTool>>) => {
  assert(result.status === "needs_confirmation");
  return result.confirmationId;
};

const rowOfSession = (stub: WriteStub, id: string) =>
  (stub.tables["workout_sessions"] ?? []).find((row) => row["id"] === id);

const setsOfSession = (stub: WriteStub, id: string) =>
  (stub.tables["workout_sets"] ?? []).filter((row) => row["session_id"] === id);

const liveSetIdsOf = (stub: WriteStub, id: string) =>
  setsOfSession(stub, id)
    .filter((row) => row["deleted_at"] === null)
    .map((row) => row["id"]);

const wroteNothing = (stub: WriteStub) =>
  assertFalse(stub.calls.some(({ method }) => method === "update" || method === "rpc"));

async function deleted(contexts = deleteContexts(), sessionId = thursdayId) {
  const confirmationId = confirmationIdOf(
    await executeTool(contexts.asking, "delete_workout", { session_id: sessionId }),
  );
  const result = await executeTool(contexts.confirming, "delete_workout", {
    session_id: sessionId,
    confirmation_id: confirmationId,
  });
  assert(result.status === "ok" && result.actionId !== null);
  return { ...contexts, result, actionId: result.actionId };
}

Deno.test(
  "the tool is not strict, destructive, refuses a live workout and writes the sessions table",
  () => {
    assertEquals(deleteWorkoutTool.strict, false);
    assertEquals(deleteWorkoutTool.annotations, { readOnlyHint: false, destructiveHint: true });
    assertEquals(deleteWorkoutTool.refusesDuringWorkout, true);
    assertEquals(deleteWorkoutTool.targetTable, "workout_sessions");
  },
);

Deno.test(
  "deleting asks first, with the board's question and the sets as the app counts them, and writes nothing",
  async () => {
    const { asking, stub, store } = deleteContexts();

    const result = await executeTool(asking, "delete_workout", { session_id: thursdayId });

    assert(result.status === "needs_confirmation");
    // Two warm-ups and a removed set are in the rows, and the app's count is the sixteen working sets.
    assertEquals(
      result.question,
      "Delete your Legs workout from Thursday 8 October? It has 16 sets. They leave your history and your weekly numbers.",
    );
    wroteNothing(stub);
    assertEquals(store.actions.length, 0);
    assertEquals(store.turns[0]?.pending?.tool, "delete_workout");
    assertEquals(store.turns[0]?.pending?.confirmLabel, "Delete workout");
    assertEquals(liveSetIdsOf(stub, thursdayId).length, 18);
  },
);

Deno.test("a workout with no routine day is asked about without a day name", async () => {
  const { asking } = deleteContexts();

  const result = await executeTool(asking, "delete_workout", { session_id: freeId });

  assert(result.status === "needs_confirmation");
  assertEquals(
    result.question,
    "Delete your workout from Friday 9 October? It has 3 sets. They leave your history and your weekly numbers.",
  );
});

Deno.test(
  "a workout of warm-ups only counts its warm-ups, as the app's own question does",
  async () => {
    const { asking } = deleteContexts();

    const result = await executeTool(asking, "delete_workout", { session_id: warmUpsOnlyId });

    assert(result.status === "needs_confirmation");
    assertStringIncludes(result.question, "It has 2 sets.");
  },
);

Deno.test(
  "the button's words delete the session and its sets, and build the board's card",
  async () => {
    const { result, stub, store } = await deleted();

    assertEquals(payloadOf(result), { session_id: thursdayId, deleted: true });
    assertEquals(structuredOf(result)["card"], {
      kind: "workout_deleted",
      title: "Deleted workout Legs",
      sub: "Thursday 8 October · 16 sets",
      rows: [],
      changeDetail: "Thu 8 Oct · 16 sets",
      totalText: null,
      note: null,
      link: null,
      undo: "available",
      undoneSub: "Legs on Thursday 8 October is back in your history",
    });
    assertEquals(liveSetIdsOf(stub, thursdayId), []);
    assertNotEquals(rowOfSession(stub, thursdayId)?.["deleted_at"], null);
    const [action] = store.actions;
    assertEquals(action?.tool, "delete_workout");
    assertEquals(action?.targetTable, "workout_sessions");
    assertEquals(action?.targetId, thursdayId);
  },
);

Deno.test(
  "the stamp recorded as the target's time is the session's deleted_at, character for character",
  async () => {
    const { store, stub } = await deleted();

    const stored = rowOfSession(stub, thursdayId)?.["deleted_at"];
    assertEquals(typeof stored, "string");
    // Microseconds are kept, so it is never a value that went through a Date.
    assertEquals(stored, stampOfDeletion(1));
    assertEquals(store.actions[0]?.targetUpdatedAt, stored);
    // The sets the delete took carry the same stamp, which is what Undo finds them by.
    assertEquals(
      setsOfSession(stub, thursdayId)
        .filter((row) => row["id"] !== removedEarlierId)
        .every((row) => row["deleted_at"] === stored),
      true,
    );
    assertEquals(
      setsOfSession(stub, thursdayId).find((row) => row["id"] === removedEarlierId)?.["deleted_at"],
      removedEarlierStamp,
    );
  },
);

Deno.test(
  "Undo needs no stored value, so the write keeps none and the model reads no sets",
  async () => {
    const { result } = await deleted();

    assertFalse("undo" in structuredOf(result));
    assertEquals(Object.keys(payloadOf(result) as object), ["session_id", "deleted"]);
  },
);

Deno.test("after Keep it the confirmation asks again and nothing is deleted", async () => {
  const { asking, keeping, stub, store } = deleteContexts();
  const confirmationId = confirmationIdOf(
    await executeTool(asking, "delete_workout", { session_id: thursdayId }),
  );

  const result = await executeTool(keeping, "delete_workout", {
    session_id: thursdayId,
    confirmation_id: confirmationId,
  });

  assertObjectMatch(result, { status: "needs_confirmation", asksAgain: true });
  wroteNothing(stub);
  assertEquals(store.actions.length, 0);
});

Deno.test("any other words ask again and delete nothing", async () => {
  const { asking, typing, stub, store } = deleteContexts();
  const confirmationId = confirmationIdOf(
    await executeTool(asking, "delete_workout", { session_id: thursdayId }),
  );

  const result = await executeTool(typing, "delete_workout", {
    session_id: thursdayId,
    confirmation_id: confirmationId,
  });

  assertObjectMatch(result, { status: "needs_confirmation", asksAgain: true });
  wroteNothing(stub);
  assertEquals(store.actions.length, 0);
});

Deno.test("a confirmation is for the workout it was asked about", async () => {
  const { asking, confirming, stub, store } = deleteContexts();
  const confirmationId = confirmationIdOf(
    await executeTool(asking, "delete_workout", { session_id: thursdayId }),
  );

  const other = await executeTool(confirming, "delete_workout", {
    session_id: freeId,
    confirmation_id: confirmationId,
  });

  assertObjectMatch(other, { status: "error", code: "confirmation_invalid" });
  wroteNothing(stub);
  assertEquals(store.actions.length, 0);
});

Deno.test("a press with no question before it asks the question and writes nothing", async () => {
  const { confirming, stub, store } = deleteContexts();

  // The later turn's words are the confirm button's, but no earlier turn asked: there is nothing to confirm.
  const result = await executeTool(confirming, "delete_workout", { session_id: thursdayId });

  assertEquals(result.status, "needs_confirmation");
  assert(result.status === "needs_confirmation" && result.asksAgain !== true);
  wroteNothing(stub);
  assertEquals(store.actions.length, 0);
});

Deno.test(
  "a live workout as the target is refused by the tool itself, whatever the executor's guard saw",
  async () => {
    const { confirming, stub } = deleteContexts({ live: true });

    // The tool's `run` called directly, past the guard and the question, as when a workout began in between.
    const output = await deleteWorkoutTool.run(confirming, { session_id: liveId });

    assertEquals(output, { data: { error: "workout_in_progress" }, target: null });
    wroteNothing(stub);
    assertEquals(rowOfSession(stub, liveId)?.["deleted_at"], null);
    assertEquals(liveSetIdsOf(stub, liveId).length, 1);
  },
);

Deno.test(
  "with a workout in progress the executor refuses the call before any question and nothing is stored",
  async () => {
    const { asking, stub, store } = deleteContexts({ live: true });

    const result = await executeTool(asking, "delete_workout", { session_id: thursdayId });
    // The live workout is in the rows, so the guard answers for any session of the person.
    assertObjectMatch(result, { status: "error", code: "workout_in_progress" });

    // Asking about the live workout itself needs no question either: `needsConfirmation` gives none for it.
    const need = await deleteWorkoutTool.needsConfirmation?.({ session_id: liveId }, asking);
    assertEquals(need, false);
    wroteNothing(stub);
    assertEquals(store.turns[0]?.pending, null);
    assertEquals(store.actions.length, 0);
  },
);

Deno.test(
  "another user's workout, a deleted one and an unknown id are not found, with no question and no write",
  async () => {
    const { asking, confirming, stub, store } = deleteContexts();
    Object.assign(rowOfSession(stub, warmUpsOnlyId) ?? {}, {
      deleted_at: "2026-10-11T08:00:00+00:00",
    });

    for (const id of [theirsId, warmUpsOnlyId, unknownId]) {
      const asked = await executeTool(asking, "delete_workout", { session_id: id });
      assertEquals(asked.status, "ok");
      assertEquals(payloadOf(asked), { error: "not_found" });
      assertEquals((await deleteWorkoutTool.run(confirming, { session_id: id })).data, {
        error: "not_found",
      });
    }
    wroteNothing(stub);
    assertEquals(store.turns[0]?.pending, null);
    assertEquals(store.actions.length, 0);
    assertEquals(rowOfSession(stub, theirsId)?.["deleted_at"], null);
  },
);

Deno.test("a session id that is not an id is invalid input, with nothing asked", async () => {
  const { asking, store } = deleteContexts();

  const result = await executeTool(asking, "delete_workout", { session_id: "last Thursday" });

  assertObjectMatch(result, { status: "error", code: "invalid_input" });
  assertEquals(store.turns[0]?.pending, null);
});

Deno.test(
  "a read-back that fails does not throw: the delete stands, the action is kept, and Undo answers unavailable",
  async () => {
    const contexts = deleteContexts();
    const { asking, confirming, stub, store } = contexts;
    const confirmationId = confirmationIdOf(
      await executeTool(asking, "delete_workout", { session_id: thursdayId }),
    );
    // Reads of the sessions table on the confirming call: the guard, the question, `run`'s own read, and then the
    // stamp read-back, which is the one that fails.
    stub.failNextReadFrom("workout_sessions", 3);

    const result = await executeTool(confirming, "delete_workout", {
      session_id: thursdayId,
      confirmation_id: confirmationId,
    });

    assertEquals(result.status, "ok");
    assertNotEquals(rowOfSession(stub, thursdayId)?.["deleted_at"], null);
    assertEquals(structuredOf(result)["card"] !== undefined, true);
    assertEquals(store.actions.length, 1);
    assertEquals(store.actions[0]?.targetId, thursdayId);
    assertEquals(store.actions[0]?.targetUpdatedAt, null);
    const undone = await undoAction(confirming, store.actions[0]?.id ?? "");
    assertEquals(undone, { status: "error", code: "undo_unavailable" });
    assertEquals(liveSetIdsOf(stub, thursdayId), []);
  },
);

Deno.test("a delete the database refuses is a failed call, with nothing recorded", async () => {
  const { asking, confirming, stub, store } = deleteContexts();
  const confirmationId = confirmationIdOf(
    await executeTool(asking, "delete_workout", { session_id: thursdayId }),
  );
  // Gone between the question and the press: the delete finds no live session.
  Object.assign(rowOfSession(stub, thursdayId) ?? {}, { deleted_at: "2026-11-07T09:00:00+00:00" });

  const result = await executeTool(confirming, "delete_workout", {
    session_id: thursdayId,
    confirmation_id: confirmationId,
  });

  assertEquals(payloadOf(result), { error: "not_found" });
  assertEquals(store.actions.length, 0);
});

Deno.test(
  "Undo gives back the session and exactly its sets, leaves an earlier removed set removed, and a second press is already_undone",
  async () => {
    const { confirming, actionId, stub } = await deleted();
    assertEquals(liveSetIdsOf(stub, thursdayId), []);

    const first = await undoAction(confirming, actionId);
    const second = await undoAction(confirming, actionId);

    assertEquals(first, { status: "undone", actionId });
    assertEquals(second, { status: "error", code: "already_undone" });
    assertEquals(rowOfSession(stub, thursdayId)?.["deleted_at"], null);
    assertEquals(liveSetIdsOf(stub, thursdayId).length, 18);
    const removed = setsOfSession(stub, thursdayId).find((row) => row["id"] === removedEarlierId);
    assertEquals(removed?.["deleted_at"], removedEarlierStamp);
    // Nothing of another workout was touched.
    assertEquals(liveSetIdsOf(stub, freeId).length, 3);
  },
);

Deno.test(
  "Undo still restores after the conversation is deleted, and never asks for a stored value",
  async () => {
    const { confirming, actionId, store, stub } = await deleted();
    // Deleting the conversation sets the action's conversation and turn to null, and the card with its
    // stored values goes with it. The action and its target stay.
    Object.assign(store.actions[0] ?? {}, { conversationId: null, turnId: null });
    store.previousValues.clear();
    const never = () => Promise.reject(new Error("inverse must not read a stored value"));
    const before = store.calls["previousValueOf"];

    const result = await undoAction({ ...confirming, previousValueOf: never }, actionId);

    assertEquals(result, { status: "undone", actionId });
    assertEquals(store.calls["previousValueOf"], before);
    assertEquals(liveSetIdsOf(stub, thursdayId).length, 18);
  },
);

Deno.test(
  "Undo waits while a workout is in progress, keeps the action, and works after it ends",
  async () => {
    const { confirming, actionId, stub } = await deleted();
    // A workout begins after the delete, which the guard answers for.
    stub.tables["workout_sessions"]?.push(
      sessionRow(9, { id: liveId, ended_at: null, workout_sets: [] }),
    );

    const waiting = await undoAction(confirming, actionId);

    assertEquals(waiting, {
      status: "error",
      code: "undo_unavailable",
      reason: "workout_in_progress",
    });
    assertEquals(liveSetIdsOf(stub, thursdayId), []);
    Object.assign(rowOfSession(stub, liveId) ?? {}, { ended_at: "2026-11-07T11:00:00+00:00" });
    const after = await undoAction(confirming, actionId);
    assertEquals(after, { status: "undone", actionId });
    assertEquals(liveSetIdsOf(stub, thursdayId).length, 18);
  },
);

Deno.test(
  "Undo is unavailable, and writes nothing, once the workout is already back in the history",
  async () => {
    const { confirming, actionId, stub } = await deleted();
    // Back by some other way: the session and every set carry no stamp.
    Object.assign(rowOfSession(stub, thursdayId) ?? {}, { deleted_at: null });
    for (const set of setsOfSession(stub, thursdayId)) {
      if (set["id"] !== removedEarlierId) {
        set["deleted_at"] = null;
      }
    }

    const result = await undoAction(confirming, actionId);

    assertEquals(result, { status: "error", code: "undo_unavailable" });
    assertEquals(liveSetIdsOf(stub, thursdayId).length, 18);
  },
);

Deno.test(
  "a workout deleted again with another stamp, or not the user's, is not restored by this action",
  async () => {
    const { confirming, actionId, store, stub } = await deleted();
    Object.assign(rowOfSession(stub, thursdayId) ?? {}, {
      deleted_at: "2026-11-08T09:00:00+00:00",
    });

    const again = await undoAction(confirming, actionId);

    assertEquals(again, { status: "error", code: "undo_unavailable" });
    assertEquals(liveSetIdsOf(stub, thursdayId), []);
    store.actions.push({
      id: "action-theirs",
      userId: confirming.userId,
      conversationId: confirming.turn.conversationId,
      turnId: later,
      turnSeq: 1,
      tool: "delete_workout",
      targetTable: "workout_sessions",
      targetId: theirsId,
      targetIds: null,
      targetLocalDate: null,
      targetUpdatedAt: "2026-11-07T10:00:09.123456+00:00",
      undoneAt: null,
    });
    Object.assign(rowOfSession(stub, theirsId) ?? {}, {
      deleted_at: "2026-11-07T10:00:09.123456+00:00",
    });

    const theirs = await undoAction(confirming, "action-theirs");

    assertEquals(theirs, { status: "error", code: "undo_unavailable" });
    assertNotEquals(rowOfSession(stub, theirsId)?.["deleted_at"], null);
  },
);

Deno.test(
  "a retry is safe: the session made live and the sets not yet, then Undo again brings the sets back",
  async () => {
    const { confirming, actionId, stub } = await deleted();
    // The first write of the restore lands, and the second fails.
    stub.failNextWriteTo("workout_sets");

    const failed = await undoAction(confirming, actionId);

    assertEquals(failed, { status: "error", code: "undo_failed" });
    assertEquals(rowOfSession(stub, thursdayId)?.["deleted_at"], null);
    assertEquals(liveSetIdsOf(stub, thursdayId), []);

    const retried = await undoAction(confirming, actionId);
    const third = await undoAction(confirming, actionId);

    assertEquals(retried, { status: "undone", actionId });
    assertEquals(third, { status: "error", code: "already_undone" });
    assertEquals(liveSetIdsOf(stub, thursdayId).length, 18);
  },
);

Deno.test("the buttons are the board's, and the same words confirm the call", async () => {
  const { asking } = deleteContexts();
  const input = { session_id: thursdayId };

  const need = await deleteWorkoutTool.needsConfirmation?.(input, asking);

  assertEquals(confirmWordsFor("delete_workout", input), {
    confirmLabel: "Delete workout",
    cancelLabel: "Keep it",
    tone: "danger",
  });
  assertEquals(
    need !== false && need !== undefined ? need.confirmLabel : null,
    confirmWordsFor("delete_workout", input)?.confirmLabel,
  );
  assertEquals(confirmWordsFor("delete_workout", {}), null);
});

Deno.test("no log line or report holds a day name, an exercise name or a stamp", async () => {
  const spy = spyOnConsole();
  try {
    const contexts = deleteContexts();
    const confirmationId = confirmationIdOf(
      await executeTool(contexts.asking, "delete_workout", { session_id: thursdayId }),
    );
    contexts.stub.failNextReadFrom("workout_sessions", 3);
    await executeTool(contexts.confirming, "delete_workout", {
      session_id: thursdayId,
      confirmation_id: confirmationId,
    });
  } finally {
    spy.restore();
  }

  const lines = spy.lines.join("\n");
  for (const word of ["Legs", "squat", "2026-11-07T10"]) {
    assertFalse(lines.includes(word), word);
  }
});

Deno.test(
  "the description tells the model to word the question before the call, to take the id from get_workouts and to say the refusal",
  () => {
    const { description } = deleteWorkoutTool;

    assertStringIncludes(description, "get_workouts");
    assertStringIncludes(
      description,
      "in the same response as the call, before it, write the question",
    );
    assertStringIncludes(description, "When they say no, do not call again.");
    assertStringIncludes(description, "workout_in_progress");
    assertFalse(description.includes("ask the user"));
  },
);
