import { assert, assertEquals, assertFalse, assertObjectMatch } from "@std/assert";

import { executeTool } from "../executor.ts";
import { undoOutcomeSchema } from "../store.ts";
import { undoAction } from "../undo.ts";
import {
  activeIdsOf,
  archivedIdsOf,
  fullBodyId,
  noRoutineActive,
  otherUsersId,
  pushPullLegsId,
  routineContext,
  routineRows,
  setActiveRoutineRpc,
  storeUndoOf,
  upperLowerId,
} from "./routineWriteFixtures.ts";
import { payloadOf, stubCaller } from "./testing.ts";
import { sessionRow } from "./trainingFixtures.ts";
import { structuredOf } from "./writeFixtures.ts";
import { setActiveRoutineTool } from "./setActiveRoutine.ts";

const tools = [setActiveRoutineTool];

async function activate(routineId: string | null, rows = routineRows()) {
  const made = routineContext(tools, rows);
  const result = await executeTool(made.ctx, "set_active_routine", { routine_id: routineId });
  assert(result.status === "ok");
  storeUndoOf(made.store, result);
  return { ...made, result };
}

Deno.test("the tool is not strict, refuses a live workout and writes the routines table", () => {
  assertEquals(setActiveRoutineTool.strict, false);
  assertEquals(setActiveRoutineTool.refusesDuringWorkout, true);
  assertEquals(setActiveRoutineTool.targetTable, "routines");
  assertEquals(setActiveRoutineTool.needsConfirmation, undefined);
});

Deno.test(
  "making a routine active replaces the active one and builds the board's card",
  async () => {
    const { result, stub, store } = await activate(pushPullLegsId);

    assertEquals(payloadOf(result), { routine_id: pushPullLegsId, is_active: true, changed: true });
    assertEquals(structuredOf(result)["card"], {
      kind: "routine_active",
      title: "Push Pull Legs is your active routine",
      sub: "Was Upper Lower · your week plans from it today",
      rows: [],
      changeDetail: "was Upper Lower",
      totalText: null,
      note: null,
      link: {
        label: "Open in routine editor",
        target: { screen: "routine_editor", routineId: pushPullLegsId },
      },
      undo: "available",
      undoneSub: "Upper Lower is your active routine again",
    });
    assertEquals(activeIdsOf(stub), [pushPullLegsId]);
    const [action] = store.actions;
    assertEquals(action?.tool, "set_active_routine");
    assertEquals(action?.targetTable, "routines");
    assertEquals(action?.targetId, pushPullLegsId);
  },
);

Deno.test(
  "the previous active routine is stored for Undo and nowhere the model reads",
  async () => {
    const { result } = await activate(pushPullLegsId);

    const undo = undoOutcomeSchema.parse(structuredOf(result)["undo"]);

    assertEquals(undo.previous, upperLowerId);
    assertEquals(typeof undo.fingerprint, "string");
    assertFalse(result.text.includes(upperLowerId));
    assertFalse(JSON.stringify(structuredOf(result)["card"]).includes(upperLowerId));
  },
);

Deno.test(
  "with no routine active before, the card leaves out what was and Undo will clear",
  async () => {
    const { result, stub } = await activate(pushPullLegsId, noRoutineActive());

    assertObjectMatch(structuredOf(result), {
      card: {
        title: "Push Pull Legs is your active routine",
        sub: "Your week plans from it today",
        link: { label: "Open in routine editor" },
        undo: "available",
        undoneSub: "No routine is active",
      },
      undo: { previous: null },
    });
    assertFalse("changeDetail" in (structuredOf(result)["card"] as object));
    assertEquals(activeIdsOf(stub), [pushPullLegsId]);
  },
);

Deno.test(
  "another person's active routine is neither replaced nor named as the one before",
  async () => {
    const { result, stub } = await activate(pushPullLegsId, noRoutineActive());

    assertObjectMatch(structuredOf(result), { card: { sub: "Your week plans from it today" } });
    assertEquals(activeIdsOf(stub), [pushPullLegsId]);
    const theirs = (stub.tables["routines"] ?? []).find((row) => row["id"] === otherUsersId);
    assertEquals(theirs?.["is_active"], true);
  },
);

Deno.test(
  "another person's routine, or one that is not there, is not_found and writes nothing",
  async () => {
    for (const id of [otherUsersId, "00000000-0000-4000-8000-0000000a0fff"]) {
      const made = routineContext(tools);

      const result = await executeTool(made.ctx, "set_active_routine", { routine_id: id });

      assertEquals(payloadOf(result), { error: "not_found" });
      assertEquals(activeIdsOf(made.stub), [upperLowerId]);
      assertEquals(made.store.actions.length, 0);
    }
  },
);

Deno.test("an archived routine is refused, with no write and no action", async () => {
  const rows = routineRows().map((row) =>
    row["id"] === fullBodyId ? { ...row, is_archived: true } : row,
  );
  const made = routineContext(tools, rows);

  const result = await executeTool(made.ctx, "set_active_routine", { routine_id: fullBodyId });

  assertEquals(payloadOf(result), { error: "routine_archived" });
  assertEquals(activeIdsOf(made.stub), [upperLowerId]);
  assertFalse(made.stub.calls.some((call) => call.table === "rpc:set_active_routine"));
  assertEquals(made.store.actions.length, 0);
});

Deno.test(
  "the routine that is active already is answered plainly, with no write and no action",
  async () => {
    const made = routineContext(tools);

    const result = await executeTool(made.ctx, "set_active_routine", { routine_id: upperLowerId });

    assertEquals(payloadOf(result), { routine_id: upperLowerId, is_active: true, changed: false });
    assertEquals(structuredOf(result), {});
    assertFalse(made.stub.calls.some((call) => call.table === "rpc:set_active_routine"));
    assertEquals(made.store.actions.length, 0);
  },
);

Deno.test("null clears the active routine and builds a card with no link", async () => {
  const { result, stub } = await activate(null);

  assertEquals(payloadOf(result), { is_active: false, changed: true });
  assertObjectMatch(structuredOf(result), {
    card: {
      kind: "routine_active",
      title: "No routine is active",
      sub: "Was Upper Lower",
      changeDetail: "was Upper Lower",
      link: null,
      undo: "available",
      undoneSub: "Upper Lower is your active routine again",
    },
    undo: { previous: upperLowerId, fingerprint: "none" },
  });
  assertEquals(activeIdsOf(stub), []);
});

Deno.test("null with no routine active changes nothing and leaves no action", async () => {
  const made = routineContext(tools, noRoutineActive());

  const result = await executeTool(made.ctx, "set_active_routine", { routine_id: null });

  assertEquals(payloadOf(result), { is_active: false, changed: false });
  assertEquals(structuredOf(result), {});
  assertEquals(made.store.actions.length, 0);
});

Deno.test(
  "Undo makes the routine before active again, and a second Undo is already_undone",
  async () => {
    const { ctx, result, stub } = await activate(pushPullLegsId);
    assert(result.actionId !== null);

    const first = await undoAction(ctx, result.actionId);
    const second = await undoAction(ctx, result.actionId);

    assertEquals(first, { status: "undone", actionId: result.actionId });
    assertEquals(second, { status: "error", code: "already_undone" });
    assertEquals(activeIdsOf(stub), [upperLowerId]);
  },
);

Deno.test("Undo of a routine made active with none before clears the active routine", async () => {
  const { ctx, result, stub } = await activate(pushPullLegsId, noRoutineActive());
  assert(result.actionId !== null);

  const undone = await undoAction(ctx, result.actionId);

  assertEquals(undone, { status: "undone", actionId: result.actionId });
  assertEquals(activeIdsOf(stub), []);
});

Deno.test("Undo of a cleared routine makes it active again", async () => {
  const { ctx, result, stub } = await activate(null);
  assert(result.actionId !== null);

  const undone = await undoAction(ctx, result.actionId);

  assertEquals(undone, { status: "undone", actionId: result.actionId });
  assertEquals(activeIdsOf(stub), [upperLowerId]);
});

Deno.test(
  "Undo is unavailable with the reason changed once another routine is active",
  async () => {
    for (const rows of [routineRows(), noRoutineActive()]) {
      const { ctx, result, stub } = await activate(pushPullLegsId, rows);
      assert(result.actionId !== null);
      setActiveRoutineRpc({ p_routine_id: fullBodyId }, stub.tables);

      const undone = await undoAction(ctx, result.actionId);

      assertEquals(undone, { status: "error", code: "undo_unavailable", reason: "changed" });
      assertEquals(activeIdsOf(stub), [fullBodyId]);
    }
  },
);

Deno.test(
  "Undo is unavailable with the reason changed once the routine was made active again in the app",
  async () => {
    const { ctx, result, stub } = await activate(pushPullLegsId, noRoutineActive());
    assert(result.actionId !== null);
    setActiveRoutineRpc({ p_routine_id: pushPullLegsId }, stub.tables);

    const undone = await undoAction(ctx, result.actionId);

    assertEquals(undone, { status: "error", code: "undo_unavailable", reason: "changed" });
    assertEquals(activeIdsOf(stub), [pushPullLegsId]);
  },
);

Deno.test("Undo of a cleared routine is unavailable once another routine is active", async () => {
  const { ctx, result, stub } = await activate(null);
  assert(result.actionId !== null);
  setActiveRoutineRpc({ p_routine_id: fullBodyId }, stub.tables);

  const undone = await undoAction(ctx, result.actionId);

  assertEquals(undone, { status: "error", code: "undo_unavailable", reason: "changed" });
  assertEquals(activeIdsOf(stub), [fullBodyId]);
});

Deno.test("Undo is unavailable when the routine before was archived since", async () => {
  const { ctx, result, stub } = await activate(pushPullLegsId);
  assert(result.actionId !== null);
  Object.assign((stub.tables["routines"] ?? [])[0] ?? {}, { is_archived: true });

  const undone = await undoAction(ctx, result.actionId);

  assertEquals(undone, { status: "error", code: "undo_unavailable", reason: "changed" });
  assertEquals(activeIdsOf(stub), [pushPullLegsId]);
  assertEquals(archivedIdsOf(stub), [upperLowerId]);
});

Deno.test(
  "Undo is unavailable once the conversation is deleted, because the previous value goes with it",
  async () => {
    const { ctx, result, store, stub } = await activate(pushPullLegsId);
    assert(result.actionId !== null);
    const [action] = store.actions;
    Object.assign(action ?? {}, { conversationId: null, turnId: null });

    const undone = await undoAction(ctx, result.actionId);

    assertEquals(undone, { status: "error", code: "undo_unavailable" });
    assertEquals(activeIdsOf(stub), [pushPullLegsId]);
  },
);

Deno.test("Undo is unavailable when no previous value was stored for the action", async () => {
  const made = routineContext(tools);
  const result = await executeTool(made.ctx, "set_active_routine", { routine_id: pushPullLegsId });
  assert(result.status === "ok" && result.actionId !== null);

  const undone = await undoAction(made.ctx, result.actionId);

  assertEquals(undone, { status: "error", code: "undo_unavailable" });
  assertEquals(activeIdsOf(made.stub), [pushPullLegsId]);
});

Deno.test("a live workout refuses the write and Undo, and nothing is written", async () => {
  const made = routineContext(tools);
  const live = stubCaller({ tables: { workout_sessions: [sessionRow(1, { ended_at: null })] } });

  const refused = await executeTool({ ...made.ctx, caller: live.caller }, "set_active_routine", {
    routine_id: pushPullLegsId,
  });
  const cleared = await executeTool({ ...made.ctx, caller: live.caller }, "set_active_routine", {
    routine_id: null,
  });

  assertObjectMatch(refused, { status: "error", code: "workout_in_progress" });
  assertObjectMatch(cleared, { status: "error", code: "workout_in_progress" });
  assertEquals(made.store.actions.length, 0);
  assertEquals(made.stub.calls, []);
  assertEquals(activeIdsOf(made.stub), [upperLowerId]);
});

Deno.test(
  "Undo during a live workout answers workout_in_progress and changes nothing",
  async () => {
    const { ctx, result, stub } = await activate(pushPullLegsId);
    assert(result.actionId !== null);
    const live = stubCaller({ tables: { workout_sessions: [sessionRow(1, { ended_at: null })] } });

    const undone = await undoAction({ ...ctx, caller: live.caller }, result.actionId);

    assertEquals(undone, {
      status: "error",
      code: "undo_unavailable",
      reason: "workout_in_progress",
    });
    assertEquals(activeIdsOf(stub), [pushPullLegsId]);
  },
);

Deno.test("an input without a routine_id is invalid", async () => {
  const result = await executeTool(routineContext(tools).ctx, "set_active_routine", {});

  assertObjectMatch(result, { status: "error", code: "invalid_input" });
});

Deno.test(
  "a read-back that fails after the activation landed still gives the card and an Undo",
  async () => {
    const made = routineContext(tools);
    // The first read of the routines is the tool's own, and the second is the one after the activation.
    made.stub.failNextReadFrom("routines", 1);

    const result = await executeTool(made.ctx, "set_active_routine", {
      routine_id: pushPullLegsId,
    });
    assert(result.status === "ok" && result.actionId !== null);
    storeUndoOf(made.store, result);

    assertEquals(payloadOf(result), { routine_id: pushPullLegsId, is_active: true, changed: true });
    assertObjectMatch(structuredOf(result), {
      card: {
        kind: "routine_active",
        title: "Push Pull Legs is your active routine",
        undo: "available",
      },
      undo: { previous: upperLowerId },
    });
    assertEquals(made.store.actions.length, 1);
    assertEquals(activeIdsOf(made.stub), [pushPullLegsId]);
    // The failed read is reported, by its code and with no routine in it.
    assertEquals(
      made.reported.map(({ code }) => code),
      ["internal_error"],
    );

    const undone = await undoAction(made.ctx, result.actionId);

    assertEquals(undone, { status: "undone", actionId: result.actionId });
    assertEquals(activeIdsOf(made.stub), [upperLowerId]);
  },
);

Deno.test(
  "an Undo from a write whose stamp was not read still sees that another routine is active",
  async () => {
    const made = routineContext(tools);
    made.stub.failNextReadFrom("routines", 1);
    const result = await executeTool(made.ctx, "set_active_routine", {
      routine_id: pushPullLegsId,
    });
    assert(result.status === "ok" && result.actionId !== null);
    storeUndoOf(made.store, result);
    setActiveRoutineRpc({ p_routine_id: fullBodyId }, made.stub.tables);

    const undone = await undoAction(made.ctx, result.actionId);

    assertEquals(undone, { status: "error", code: "undo_unavailable", reason: "changed" });
    assertEquals(activeIdsOf(made.stub), [fullBodyId]);
  },
);

Deno.test("an activation the database refuses is tool_failed and leaves no action", async () => {
  const made = routineContext(tools, routineRows(), () => ({
    data: null,
    error: { code: "XX000", message: "unavailable" },
  }));

  const result = await executeTool(made.ctx, "set_active_routine", { routine_id: pushPullLegsId });

  assertObjectMatch(result, { status: "error", code: "tool_failed" });
  assertEquals(made.store.actions.length, 0);
  assertEquals(activeIdsOf(made.stub), [upperLowerId]);
  assertFalse(
    JSON.stringify(made.reported.map((failure) => String(failure.caught))).includes("Push"),
  );
});

Deno.test(
  "pressing Undo again after a changed answer answers changed again, not already_undone",
  async () => {
    const { ctx, result, stub } = await activate(pushPullLegsId);
    assert(result.actionId !== null);
    setActiveRoutineRpc({ p_routine_id: fullBodyId }, stub.tables);
    const changed = { status: "error", code: "undo_unavailable", reason: "changed" };

    const first = await undoAction(ctx, result.actionId);
    const second = await undoAction(ctx, result.actionId);

    assertEquals([first, second], [changed, changed]);
    assertEquals(activeIdsOf(stub), [fullBodyId]);
  },
);

Deno.test(
  "pressing Undo again after a failed read undoes it, and a third press is already_undone",
  async () => {
    const { ctx, result, stub } = await activate(pushPullLegsId);
    assert(result.actionId !== null);
    stub.failNextReadFrom("routines");

    const failed = await undoAction(ctx, result.actionId);
    const retried = await undoAction(ctx, result.actionId);
    const third = await undoAction(ctx, result.actionId);

    assertEquals(failed, { status: "error", code: "undo_failed" });
    assertEquals(retried, { status: "undone", actionId: result.actionId });
    assertEquals(third, { status: "error", code: "already_undone" });
    assertEquals(activeIdsOf(stub), [upperLowerId]);
  },
);

Deno.test("a read that fails after Undo landed does not turn the Undo into a failure", async () => {
  const { ctx, result, stub } = await activate(pushPullLegsId);
  assert(result.actionId !== null);
  // The first read is the inverse's own. Nothing reads after the activation.
  stub.failNextReadFrom("routines", 1);

  const undone = await undoAction(ctx, result.actionId);

  assertEquals(undone, { status: "undone", actionId: result.actionId });
  assertEquals(activeIdsOf(stub), [upperLowerId]);
});
