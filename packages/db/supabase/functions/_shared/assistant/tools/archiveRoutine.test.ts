import {
  assert,
  assertEquals,
  assertFalse,
  assertObjectMatch,
  assertStringIncludes,
} from "@std/assert";

import { ARCHIVE_ACTIVE_REFUSAL } from "../../core.ts";
import { confirmWordsFor } from "../../../assistant/confirmWords.ts";
import { executeTool } from "../executor.ts";
import { createFakeActionStore, createFakeContext, turnsOfConversation } from "../testing.ts";
import { undoAction } from "../undo.ts";
import { archiveRoutineTool } from "./archiveRoutine.ts";
import {
  archivedIdsOf,
  fullBodyId,
  otherUsersId,
  pushPullLegsId,
  routineContext,
  routineRows,
  setActiveRoutineRpc,
  upperLowerId,
} from "./routineWriteFixtures.ts";
import { payloadOf, stubCaller } from "./testing.ts";
import { sessionRow } from "./trainingFixtures.ts";
import { structuredOf } from "./writeFixtures.ts";

import type { ToolContext } from "../tool.ts";

const earlier = "00000000-0000-4000-8000-0000000000d1";
const later = "00000000-0000-4000-8000-0000000000d2";

// The earlier turn is where the model asks and the later one where the user has said yes. Upper Lower is
// the active routine, so Push Pull Legs and Full Body are the ones that can be archived.
function archiveContexts(rows = routineRows()) {
  const base = routineContext([archiveRoutineTool], rows);
  const store = createFakeActionStore({ turns: turnsOfConversation([earlier, later]) });
  const contextOn = (turnId: string, personsWords: string): ToolContext => ({
    ...createFakeContext([archiveRoutineTool], {
      store,
      personsWords,
      turn: { id: turnId, conversationId: store.turns[0]?.conversationId ?? "" },
    }).ctx,
    caller: base.stub.caller,
  });
  return {
    stub: base.stub,
    store,
    asking: contextOn(earlier, "Archive Push Pull Legs"),
    confirming: contextOn(later, "Archive routine"),
    keeping: contextOn(later, "Keep it"),
  };
}

const confirmationIdOf = (result: Awaited<ReturnType<typeof executeTool>>) => {
  assert(result.status === "needs_confirmation");
  return result.confirmationId;
};

async function archived(contexts = archiveContexts(), routineId = pushPullLegsId) {
  const confirmationId = confirmationIdOf(
    await executeTool(contexts.asking, "archive_routine", { routine_id: routineId }),
  );
  const result = await executeTool(contexts.confirming, "archive_routine", {
    routine_id: routineId,
    confirmation_id: confirmationId,
  });
  assert(result.status === "ok" && result.actionId !== null);
  return { ...contexts, result, actionId: result.actionId };
}

Deno.test(
  "the tool is not strict, destructive, refuses a live workout and writes the routines table",
  () => {
    assertEquals(archiveRoutineTool.strict, false);
    assertEquals(archiveRoutineTool.annotations, { readOnlyHint: false, destructiveHint: true });
    assertEquals(archiveRoutineTool.refusesDuringWorkout, true);
    assertEquals(archiveRoutineTool.targetTable, "routines");
  },
);

Deno.test(
  "archiving asks first, with the board's question, and writes nothing until the user says yes",
  async () => {
    const { asking, stub, store } = archiveContexts();

    const result = await executeTool(asking, "archive_routine", { routine_id: pushPullLegsId });

    assert(result.status === "needs_confirmation");
    assertEquals(
      result.question,
      "Archive Push Pull Legs? It leaves your routine list. Sessions you logged with it stay in your history.",
    );
    assertEquals(archivedIdsOf(stub), []);
    assertEquals(store.actions.length, 0);
    assertEquals(store.turns[0]?.pending?.tool, "archive_routine");
    assertEquals(store.turns[0]?.pending?.confirmLabel, "Archive routine");
  },
);

Deno.test("the button's words archive the routine and build the board's card", async () => {
  const { result, stub, store } = await archived();

  assertEquals(payloadOf(result), { routine_id: pushPullLegsId, archived: true, changed: true });
  assertEquals(structuredOf(result)["card"], {
    kind: "routine_archived",
    title: "Archived routine Push Pull Legs",
    sub: "Sessions you logged with it stay in your history",
    rows: [],
    totalText: null,
    note: null,
    link: null,
    undo: "available",
    undoneSub: "Push Pull Legs is back in your routines",
  });
  assertEquals(archivedIdsOf(stub), [pushPullLegsId]);
  const [action] = store.actions;
  assertEquals(action?.tool, "archive_routine");
  assertEquals(action?.targetTable, "routines");
  assertEquals(action?.targetId, pushPullLegsId);
});

Deno.test("Undo needs no stored value, so the write keeps none", async () => {
  const { result } = await archived();

  assertFalse("undo" in structuredOf(result));
});

Deno.test("after Keep it the confirmation asks again and nothing is archived", async () => {
  const { asking, keeping, stub, store } = archiveContexts();
  const confirmationId = confirmationIdOf(
    await executeTool(asking, "archive_routine", { routine_id: pushPullLegsId }),
  );

  const result = await executeTool(keeping, "archive_routine", {
    routine_id: pushPullLegsId,
    confirmation_id: confirmationId,
  });

  assertObjectMatch(result, { status: "needs_confirmation", asksAgain: true });
  assertEquals(archivedIdsOf(stub), []);
  assertEquals(store.actions.length, 0);
});

Deno.test("a confirmation is for the routine it was asked about", async () => {
  const { asking, confirming, stub, store } = archiveContexts();
  const confirmationId = confirmationIdOf(
    await executeTool(asking, "archive_routine", { routine_id: pushPullLegsId }),
  );

  const other = await executeTool(confirming, "archive_routine", {
    routine_id: fullBodyId,
    confirmation_id: confirmationId,
  });

  assertObjectMatch(other, { status: "error", code: "confirmation_invalid" });
  assertEquals(archivedIdsOf(stub), []);
  assertEquals(store.actions.length, 0);
});

Deno.test(
  "the active routine is refused before any question, in the app's own words, with no confirmation row",
  async () => {
    const { asking, stub, store } = archiveContexts();

    const result = await executeTool(asking, "archive_routine", { routine_id: upperLowerId });

    assertEquals(result.status, "ok");
    assertEquals(payloadOf(result), {
      error: "routine_is_active",
      say: "Make another routine active first.",
    });
    assertEquals(structuredOf(result), {});
    assertEquals(archivedIdsOf(stub), []);
    assertEquals(store.actions.length, 0);
    assertEquals(store.turns[0]?.pending, null);
    assertEquals(store.calls["storePendingConfirmation"], undefined);
    assertFalse(stub.calls.some((call) => call.method === "update"));
  },
);

Deno.test(
  "a routine that is not the user's, or not there, is not_found with no question and no write",
  async () => {
    const { asking, stub, store } = archiveContexts();

    for (const id of [otherUsersId, "00000000-0000-4000-8000-0000000a0fff"]) {
      const result = await executeTool(asking, "archive_routine", { routine_id: id });

      assertEquals(result.status, "ok");
      assertEquals(payloadOf(result), { error: "not_found" });
    }
    assertEquals(archivedIdsOf(stub), []);
    assertEquals(store.actions.length, 0);
    assertEquals(store.turns[0]?.pending, null);
  },
);

Deno.test(
  "a routine that is archived already is answered plainly, with no question and no action",
  async () => {
    const rows = routineRows().map((row) =>
      row["id"] === fullBodyId ? { ...row, is_archived: true } : row,
    );
    const { asking, store } = archiveContexts(rows);

    const result = await executeTool(asking, "archive_routine", { routine_id: fullBodyId });

    assertEquals(payloadOf(result), { routine_id: fullBodyId, archived: true, changed: false });
    assertEquals(structuredOf(result), {});
    assertEquals(store.actions.length, 0);
    assertEquals(store.turns[0]?.pending, null);
  },
);

Deno.test("Undo restores the routine, and a second Undo is already_undone", async () => {
  const { confirming, actionId, stub } = await archived();

  const first = await undoAction(confirming, actionId);
  const second = await undoAction(confirming, actionId);

  assertEquals(first, { status: "undone", actionId });
  assertEquals(second, { status: "error", code: "already_undone" });
  assertEquals(archivedIdsOf(stub), []);
});

Deno.test("Undo is unavailable once the person restored the routine in the app", async () => {
  const { confirming, actionId, stub } = await archived();
  Object.assign((stub.tables["routines"] ?? [])[1] ?? {}, { is_archived: false });

  const result = await undoAction(confirming, actionId);

  assertEquals(result, { status: "error", code: "undo_unavailable" });
});

Deno.test(
  "Undo still restores the routine after the conversation is deleted, because it keeps no stored value",
  async () => {
    const { confirming, actionId, store, stub } = await archived();
    // Deleting the conversation sets the action's conversation and turn to null, and the card with its
    // stored values goes with it. The action and its target stay.
    Object.assign(store.actions[0] ?? {}, { conversationId: null, turnId: null });
    store.previousValues.clear();

    const result = await undoAction(confirming, actionId);

    assertEquals(result, { status: "undone", actionId });
    assertEquals(archivedIdsOf(stub), []);
  },
);

Deno.test("another user's routine in an action cannot be restored by this user", async () => {
  const { confirming, stub, store } = archiveContexts(
    routineRows().map((row) => (row["id"] === otherUsersId ? { ...row, is_archived: true } : row)),
  );
  store.actions.push({
    id: "action-theirs",
    userId: confirming.userId,
    conversationId: confirming.turn.conversationId,
    turnId: later,
    turnSeq: 1,
    tool: "archive_routine",
    targetTable: "routines",
    targetId: otherUsersId,
    targetIds: null,
    targetLocalDate: null,
    targetUpdatedAt: null,
    undoneAt: null,
  });

  const result = await undoAction(confirming, "action-theirs");

  assertEquals(result, { status: "error", code: "undo_unavailable" });
  assertEquals(archivedIdsOf(stub), []);
  assertEquals(
    (stub.tables["routines"] ?? []).find((row) => row["id"] === otherUsersId)?.["is_archived"],
    true,
  );
});

Deno.test("the buttons are the board's, and the same words confirm the call", async () => {
  const { asking } = archiveContexts();
  const input = { routine_id: pushPullLegsId };

  const need = await archiveRoutineTool.needsConfirmation?.(input, asking);

  assertEquals(confirmWordsFor("archive_routine", input), {
    confirmLabel: "Archive routine",
    cancelLabel: "Keep it",
    tone: "primary",
  });
  assertEquals(
    need !== false && need !== undefined ? need.confirmLabel : null,
    confirmWordsFor("archive_routine", input)?.confirmLabel,
  );
});

Deno.test(
  "a live workout refuses the call before any question, and Undo, and nothing is written",
  async () => {
    const { asking, stub, store } = archiveContexts();
    const live = stubCaller({ tables: { workout_sessions: [sessionRow(1, { ended_at: null })] } });

    const refused = await executeTool({ ...asking, caller: live.caller }, "archive_routine", {
      routine_id: pushPullLegsId,
    });

    assertObjectMatch(refused, { status: "error", code: "workout_in_progress" });
    assertEquals(store.turns[0]?.pending, null);
    assertEquals(store.actions.length, 0);
    assertEquals(archivedIdsOf(stub), []);
    assertEquals(stub.calls, []);

    const done = await archived();
    const undone = await undoAction({ ...done.confirming, caller: live.caller }, done.actionId);
    assertEquals(undone, {
      status: "error",
      code: "undo_unavailable",
      reason: "workout_in_progress",
    });
    assertEquals(archivedIdsOf(done.stub), [pushPullLegsId]);
  },
);

Deno.test(
  "the description tells the model to word the question before the call and to say the refusal",
  () => {
    const { description } = archiveRoutineTool;

    assertStringIncludes(
      description,
      "in the same response as the call, before it, write the question",
    );
    assertStringIncludes(description, "When they say no, do not call again.");
    assertStringIncludes(description, "routine_is_active");
    assertFalse(description.includes("ask the user"));
  },
);

Deno.test(
  "a confirming call on a routine that became active after the question is refused and archives nothing",
  async () => {
    const { asking, confirming, stub, store } = archiveContexts();
    const confirmationId = confirmationIdOf(
      await executeTool(asking, "archive_routine", { routine_id: pushPullLegsId }),
    );
    setActiveRoutineRpc({ p_routine_id: pushPullLegsId }, stub.tables);

    const result = await executeTool(confirming, "archive_routine", {
      routine_id: pushPullLegsId,
      confirmation_id: confirmationId,
    });

    assertEquals(result.status, "ok");
    assertEquals(payloadOf(result), {
      error: "routine_is_active",
      say: ARCHIVE_ACTIVE_REFUSAL,
    });
    assertEquals(archivedIdsOf(stub), []);
    assertEquals(store.actions.length, 0);
    assertFalse(stub.calls.some((call) => call.method === "update"));
  },
);

Deno.test(
  "pressing Undo again after a restore in the app answers unavailable again, not already_undone",
  async () => {
    const { confirming, actionId, stub } = await archived();
    Object.assign((stub.tables["routines"] ?? [])[1] ?? {}, { is_archived: false });
    const unavailable = { status: "error", code: "undo_unavailable" };

    const first = await undoAction(confirming, actionId);
    const second = await undoAction(confirming, actionId);

    assertEquals([first, second], [unavailable, unavailable]);
  },
);

Deno.test(
  "pressing Undo again after a failed read restores it, and a third press is already_undone",
  async () => {
    const { confirming, actionId, stub } = await archived();
    stub.failNextReadFrom("routines");

    const failed = await undoAction(confirming, actionId);
    const retried = await undoAction(confirming, actionId);
    const third = await undoAction(confirming, actionId);

    assertEquals(failed, { status: "error", code: "undo_failed" });
    assertEquals(retried, { status: "undone", actionId });
    assertEquals(third, { status: "error", code: "already_undone" });
    assertEquals(archivedIdsOf(stub), []);
  },
);
