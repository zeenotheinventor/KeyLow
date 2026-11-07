import {
  assert,
  assertEquals,
  assertFalse,
  assertObjectMatch,
  assertStringIncludes,
} from "@std/assert";

import { getCurrentTrainingGoals, listTrainingGoalsHistory } from "../../repos.ts";
import { executeTool } from "../executor.ts";
import { toJsonSchema } from "../tool.ts";
import { undoAction } from "../undo.ts";
import {
  currentAnswers,
  goalRowId,
  goalsCall,
  goalsContext,
  goalsTableRow,
  otherPersonsGoal,
  savedInTheApp,
} from "./goalsFixtures.ts";
import { payloadOf } from "./testing.ts";
import { updateTrainingGoalsTool } from "./updateTrainingGoals.ts";
import { structuredOf } from "./writeFixtures.ts";
import { conversationId, spyOnConsole, turnId, userId } from "../testing.ts";

type Contexts = ReturnType<typeof goalsContext>;

const contexts = (options: Parameters<typeof goalsContext>[1] = {}) =>
  goalsContext([updateTrainingGoalsTool], options);

const update = (c: Contexts, given: Record<string, unknown>) =>
  executeTool(c.ctx, "update_training_goals", goalsCall(given));

const goalRowsOf = (c: Contexts) => c.stub.tables["training_goals"] ?? [];
const currentRowOf = (c: Contexts) => goalRowsOf(c).find((row) => row["effective_to"] === null);
const rpcCallsOf = (c: Contexts) => c.stub.calls.filter(({ method }) => method === "rpc");

const cardOf = (result: Awaited<ReturnType<typeof update>>) => {
  const card = structuredOf(result)["card"];
  assert(typeof card === "object" && card !== null);
  return card;
};

const fullGym = [
  "barbell",
  "dumbbell",
  "kettlebell",
  "cable",
  "machine",
  "smith_machine",
  "ez_bar",
  "band",
  "bodyweight",
];

const row = (name: string, amountText: string | null, kcalText: string) => ({
  name,
  amountText,
  time: null,
  kcalText,
  match: null,
  matchedFood: null,
  estimate: false,
});

Deno.test("update_training_goals is a write tool on training_goals that a workout blocks", () => {
  assertEquals(updateTrainingGoalsTool.kind, "write");
  assertEquals(updateTrainingGoalsTool.targetTable, "training_goals");
  assertEquals(updateTrainingGoalsTool.refusesDuringWorkout, true);
  assertEquals(updateTrainingGoalsTool.strict, false);
});

Deno.test("it asks for nothing first, because the earlier goal stays in the history", () => {
  assertEquals(updateTrainingGoalsTool.needsConfirmation, undefined);
});

Deno.test("the model is sent every answer as nullable and no priority or version", () => {
  const schema = toJsonSchema(updateTrainingGoalsTool);

  assertEquals(Object.keys(schema["properties"] as object).sort(), [
    "days_per_week",
    "equipment",
    "experience",
    "focus",
    "goal",
    "session_minutes",
  ]);
  assertEquals((schema["required"] as string[]).length, 6);
});

Deno.test("the description says what a null does and what a first goal needs", () => {
  assertStringIncludes(updateTrainingGoalsTool.description, "null");
  assertStringIncludes(updateTrainingGoalsTool.description, "ask_user");
  assertStringIncludes(updateTrainingGoalsTool.description, "full gym");
});

Deno.test("one answer changed keeps the others, and the card names only what changed", async () => {
  const c = contexts();

  const result = await update(c, { goal: "strength", days_per_week: 3 });

  assertEquals(result.status, "ok");
  assertEquals(payloadOf(result), {
    saved: true,
    first_goal: false,
    changed: ["goal", "days_per_week"],
  });
  assertObjectMatch(currentRowOf(c) ?? {}, {
    goal: "strength",
    days_per_week: 3,
    focus: ["arms"],
    session_minutes: 45,
    equipment: ["barbell", "dumbbell"],
    experience: "intermediate",
  });
  assertObjectMatch(cardOf(result), {
    kind: "goals_updated",
    title: "Updated your training goals",
    rows: [row("Goal", "Was Look better", "Get stronger"), row("Days a week", "Was 4", "3")],
    changeDetail: "goal, days a week",
    note: "Your next suggestions use these goals. Your routines stay as they are.",
    link: null,
    undo: "available",
    undoneSub: "Put back your goal, Look better, and 4 days a week",
  });
});

Deno.test("an answer given as it already is leaves the rest of the goal and one row", async () => {
  const c = contexts();

  const result = await update(c, { goal: "aesthetic", session_minutes: 60 });

  assertEquals(payloadOf(result), { saved: true, first_goal: false, changed: ["session_minutes"] });
  assertObjectMatch(cardOf(result), { rows: [row("Session", "Was 45 minutes", "60 minutes")] });
});

Deno.test("a list given in another order is no change", async () => {
  const c = contexts();

  const result = await update(c, { equipment: ["dumbbell", "barbell"], focus: ["arms"] });

  assertEquals(result.status, "ok");
  assertEquals(payloadOf(result), { saved: false, unchanged: true });
  assertEquals(rpcCallsOf(c).length, 0);
});

Deno.test(
  "a change to nothing saves no goal, leaves no action or card and spends no slot",
  async () => {
    const c = contexts();

    const result = await update(c, { goal: "aesthetic", days_per_week: 4 });

    assertEquals(payloadOf(result), { saved: false, unchanged: true });
    assertEquals(structuredOf(result), {});
    assertEquals(result.status === "ok" ? result.actionId : "x", null);
    assertEquals(c.store.actions.length, 0);
    assertEquals(rpcCallsOf(c).length, 0);
    assertEquals(goalRowsOf(c).length, 1);
  },
);

Deno.test("a call that sends nothing but nulls is no change either", async () => {
  const c = contexts();

  const result = await update(c, {});

  assertEquals(payloadOf(result), { saved: false, unchanged: true });
  assertEquals(c.store.actions.length, 0);
});

Deno.test(
  "a successful change names the new row as the target and stores no value for Undo",
  async () => {
    const c = contexts();

    const result = await update(c, { days_per_week: 5 });

    const [action] = c.store.actions;
    assertEquals(action?.tool, "update_training_goals");
    assertEquals(action?.targetTable, "training_goals");
    assertEquals(action?.targetId, currentRowOf(c)?.["id"]);
    // The goal is versioned, so the row before is the previous value and nothing is stored beside the card.
    assertFalse("undo" in structuredOf(result));
  },
);

Deno.test("a first goal from goal and experience saves the four starting answers", async () => {
  const c = contexts({ goals: [] });

  const result = await update(c, { goal: "aesthetic", experience: "intermediate" });

  assertEquals(result.status, "ok");
  assertEquals(payloadOf(result), {
    saved: true,
    first_goal: true,
    changed: ["goal", "experience"],
    also_set: ["days_per_week", "session_minutes", "equipment"],
  });
  assertObjectMatch(currentRowOf(c) ?? {}, {
    goal: "aesthetic",
    experience: "intermediate",
    focus: [],
    days_per_week: 3,
    session_minutes: 60,
    equipment: fullGym,
  });
  assertObjectMatch(cardOf(result), {
    kind: "goals_updated",
    title: "Saved your training goals",
    rows: [row("Goal", null, "Look better"), row("Experience", null, "Intermediate")],
    note: "Also set to start: 3 days a week, 60 minutes, full gym. Change them on the Goal screen.",
    undoneSub: "Your training goals are cleared",
  });
});

Deno.test("a first goal takes the days the person named and says so in the note", async () => {
  const c = contexts({ goals: [] });

  const result = await update(c, { goal: "strength", experience: "beginner", days_per_week: 5 });

  assertObjectMatch(currentRowOf(c) ?? {}, { days_per_week: 5, session_minutes: 60 });
  assertObjectMatch(cardOf(result), {
    note: "Also set to start: 5 days a week, 60 minutes, full gym. Change them on the Goal screen.",
  });
});

Deno.test(
  "a first goal keeps an answer the person gave and does not call it a starting one",
  async () => {
    const c = contexts({ goals: [] });

    const result = await update(c, {
      goal: "hybrid",
      experience: "advanced",
      equipment: ["dumbbell"],
      session_minutes: 30,
    });

    assertObjectMatch(currentRowOf(c) ?? {}, { equipment: ["dumbbell"], session_minutes: 30 });
    assertObjectMatch(cardOf(result), {
      note: "Also set to start: 3 days a week. Change it on the Goal screen.",
    });
  },
);

for (const missing of [
  { name: "the experience", given: { goal: "aesthetic" }, needs: ["experience"] },
  { name: "the goal", given: { experience: "beginner" }, needs: ["goal"] },
  { name: "both", given: { days_per_week: 3 }, needs: ["goal", "experience"] },
]) {
  Deno.test(
    `with no goal and ${missing.name} missing nothing saves and the tool answers needs`,
    async () => {
      const c = contexts({ goals: [] });

      const result = await update(c, missing.given);

      assertEquals(result.status, "ok");
      assertEquals(payloadOf(result), { needs: missing.needs });
      assertEquals(structuredOf(result), {});
      assertEquals(c.store.actions.length, 0);
      assertEquals(rpcCallsOf(c).length, 0);
      assertEquals(goalRowsOf(c).length, 0);
    },
  );
}

Deno.test("with a goal, a missing goal or experience is just left as it is", async () => {
  const c = contexts();

  const result = await update(c, { days_per_week: 2 });

  assertEquals(payloadOf(result), { saved: true, first_goal: false, changed: ["days_per_week"] });
});

Deno.test(
  "an empty equipment list or a repeated focus is refused by field, with nothing saved",
  async () => {
    const c = contexts();

    const noEquipment = await update(c, { equipment: [] });
    const repeatedFocus = await update(c, { focus: ["arms", "arms"] });

    assertObjectMatch(noEquipment, { status: "error", code: "invalid_input" });
    assertEquals(payloadOf(noEquipment), { error: "invalid_input", fields: ["equipment"] });
    assertEquals(payloadOf(repeatedFocus), { error: "invalid_input", fields: ["focus"] });
    assertEquals(rpcCallsOf(c).length, 0);
  },
);

Deno.test("a focus can be cleared with an empty list", async () => {
  const c = contexts();

  const result = await update(c, { focus: [] });

  assertEquals(payloadOf(result), { saved: true, first_goal: false, changed: ["focus"] });
  assertObjectMatch(cardOf(result), { rows: [row("Focus", "Was Arms", "None")] });
});

Deno.test("a live workout refuses the change and saves nothing", async () => {
  const c = contexts();
  c.startWorkout();

  const result = await update(c, { days_per_week: 5 });

  assertObjectMatch(result, { status: "error", code: "workout_in_progress" });
  assertEquals(rpcCallsOf(c).length, 0);
  assertEquals(c.store.actions.length, 0);
});

Deno.test(
  "a goal saved whose read back would fail still answers with the card and an Undo",
  async () => {
    const c = contexts();
    // The first read is the goal before. Any read of the goals after the save would fail.
    c.stub.failNextReadFrom("training_goals", 1);

    const result = await update(c, { goal: "strength" });

    assertEquals(result.status, "ok");
    assertObjectMatch(cardOf(result), { kind: "goals_updated", undo: "available" });
    assertEquals(c.store.actions[0]?.targetId, goalRowId(101));
    assertEquals(c.reported.length, 0);
  },
);

Deno.test("Undo with an earlier goal saves its answers again as a new row", async () => {
  const c = contexts();
  await update(c, { goal: "strength", days_per_week: 3 });
  const [action] = c.store.actions;

  const undone = await undoAction(c.ctx, action?.id ?? "");

  assertEquals(undone, { status: "undone", actionId: action?.id });
  assertObjectMatch(currentRowOf(c) ?? {}, currentAnswers);
  assertEquals(goalRowsOf(c).length, 3);
  assertEquals(goalRowsOf(c)[0]?.["id"], goalRowId(102));
  assertEquals((await getCurrentTrainingGoals(c.ctx.caller))?.goal, "aesthetic");
});

Deno.test("Undo of a change whose goal read back would fail still answers undone", async () => {
  const c = contexts();
  await update(c, { goal: "strength" });
  // The read of the history is the first, so any read after the save would fail.
  c.stub.failNextReadFrom("training_goals", 1);

  const undone = await undoAction(c.ctx, c.store.actions[0]?.id ?? "");

  assertEquals(undone.status, "undone");
  assertEquals(c.reported.length, 0);
});

Deno.test("Undo of a first goal closes the row, so the person has no goal as before", async () => {
  const c = contexts({ goals: [] });
  await update(c, { goal: "aesthetic", experience: "beginner" });
  const savesBefore = c.rpc.saves();

  const undone = await undoAction(c.ctx, c.store.actions[0]?.id ?? "");

  assertEquals(undone.status, "undone");
  assertEquals(currentRowOf(c), undefined);
  assertEquals(await getCurrentTrainingGoals(c.ctx.caller), null);
  assertEquals(c.rpc.saves(), savesBefore);
  assertEquals(goalRowsOf(c).length, 1);
  assert(
    Date.parse(String(goalRowsOf(c)[0]?.["effective_to"])) >
      Date.parse(String(goalRowsOf(c)[0]?.["effective_from"])),
  );
});

Deno.test("a goal changed in the app since answers changed, and Undo changes nothing", async () => {
  const c = contexts();
  await update(c, { goal: "strength" });
  savedInTheApp(c.rpc, c.stub.tables, { ...currentAnswers, days_per_week: 6 });
  const rowsBefore = JSON.stringify(goalRowsOf(c));

  const undone = await undoAction(c.ctx, c.store.actions[0]?.id ?? "");

  assertEquals(undone, { status: "error", code: "undo_unavailable", reason: "changed" });
  assertEquals(JSON.stringify(goalRowsOf(c)), rowsBefore);
});

Deno.test(
  "Undo of a first goal after the person changed it in the app closes nothing",
  async () => {
    const c = contexts({ goals: [] });
    await update(c, { goal: "aesthetic", experience: "beginner" });
    savedInTheApp(c.rpc, c.stub.tables, { ...currentAnswers, days_per_week: 6 });

    const undone = await undoAction(c.ctx, c.store.actions[0]?.id ?? "");

    assertEquals(undone, { status: "error", code: "undo_unavailable", reason: "changed" });
    assertEquals(currentRowOf(c)?.["days_per_week"], 6);
  },
);

Deno.test(
  "the second of two changes undone first, the first answers changed and the goal is left",
  async () => {
    const c = contexts();
    await update(c, { goal: "strength" });
    await update(c, { days_per_week: 6 });
    const [first, second] = c.store.actions;

    const secondUndone = await undoAction(c.ctx, second?.id ?? "");
    const firstUndone = await undoAction(c.ctx, first?.id ?? "");

    assertEquals(secondUndone.status, "undone");
    assertEquals(firstUndone, { status: "error", code: "undo_unavailable", reason: "changed" });
    // The goal after the second Undo is the one the first change left, not the one before it.
    assertObjectMatch(currentRowOf(c) ?? {}, { goal: "strength", days_per_week: 4 });
  },
);

Deno.test("Undo pressed twice saves the earlier goal once", async () => {
  const c = contexts();
  await update(c, { goal: "strength" });
  const actionId = c.store.actions[0]?.id ?? "";

  await undoAction(c.ctx, actionId);
  const again = await undoAction(c.ctx, actionId);

  assertEquals(again, { status: "error", code: "already_undone" });
  assertEquals(goalRowsOf(c).length, 3);
});

Deno.test(
  "Undo of a first goal after an earlier first goal was undone closes the row and brings back nothing",
  async () => {
    const c = contexts({ goals: [] });
    await update(c, { goal: "aesthetic", experience: "beginner" });
    await undoAction(c.ctx, c.store.actions[0]?.id ?? "");
    await update(c, { goal: "strength", experience: "advanced" });
    assertEquals((await listTrainingGoalsHistory(c.ctx.caller)).length, 2);

    const undone = await undoAction(c.ctx, c.store.actions[1]?.id ?? "");

    assertEquals(undone.status, "undone");
    assertEquals(await getCurrentTrainingGoals(c.ctx.caller), null);
    assertEquals(goalRowsOf(c).length, 2);
  },
);

Deno.test("a live workout refuses Undo, and the action stays undoable", async () => {
  const c = contexts();
  await update(c, { goal: "strength" });
  c.startWorkout();

  const undone = await undoAction(c.ctx, c.store.actions[0]?.id ?? "");

  assertEquals(undone, {
    status: "error",
    code: "undo_unavailable",
    reason: "workout_in_progress",
  });
  assertEquals(c.store.actions[0]?.undoneAt, null);
  assertEquals(goalRowsOf(c).length, 2);
});

Deno.test("A's Undo never touches B's goal", async () => {
  const c = contexts({ goals: [goalsTableRow(1), otherPersonsGoal()] });
  await update(c, { goal: "strength" });
  const others = JSON.stringify(goalRowsOf(c).filter((each) => each["id"] === goalRowId(900)));

  const undone = await undoAction(c.ctx, c.store.actions[0]?.id ?? "");

  assertEquals(undone.status, "undone");
  assertEquals(
    JSON.stringify(goalRowsOf(c).filter((each) => each["id"] === goalRowId(900))),
    others,
  );
  assertEquals(goalRowsOf(c).find((each) => each["id"] === goalRowId(900))?.["goal"], "strength");
});

Deno.test(
  "an action that names B's goal row is changed for A, and B's goal stays current",
  async () => {
    const c = contexts({ goals: [otherPersonsGoal()] });
    c.store.actions.push({
      id: "action-forged",
      userId,
      conversationId,
      turnId,
      turnSeq: 1,
      tool: "update_training_goals",
      targetTable: "training_goals",
      targetId: goalRowId(900),
      targetIds: null,
      targetLocalDate: null,
      targetUpdatedAt: null,
      undoneAt: null,
    });

    const undone = await undoAction(c.ctx, "action-forged");

    assertEquals(undone, { status: "error", code: "undo_unavailable", reason: "changed" });
    assertEquals(goalRowsOf(c)[0]?.["effective_to"], null);
    assertEquals(goalRowsOf(c).length, 1);
  },
);

Deno.test(
  "a refused save answers tool_failed and reports the action and the code, never an answer",
  async () => {
    const spy = spyOnConsole();
    const c = goalsContext([updateTrainingGoalsTool], {
      rpc: () => ({
        data: null,
        error: { code: "XX000", message: "the row holds aesthetic and strength and barbell" },
      }),
    });
    let result;
    try {
      result = await update(c, { goal: "strength" });
    } finally {
      spy.restore();
    }

    assertObjectMatch(result, { status: "error", code: "tool_failed" });
    assertEquals(c.store.actions.length, 0);
    const [reported] = c.reported;
    assertEquals(
      reported?.caught instanceof Error ? reported.caught.message : "",
      "Could not save your training goals (XX000)",
    );
    assertEquals(
      spy.lines.filter((line) => /strength|aesthetic|barbell/.test(line)),
      [],
    );
    assertFalse(/strength|aesthetic|barbell/.test(result.text));
  },
);
