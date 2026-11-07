// What follows a press of "Delete workout" that a workout in progress refused (KEY-907), on the real turn loop
// and the real executor and tool, with a model that is scripted. Ask again sends "Delete workout" as the person's
// message, and the question is whether that ever writes without a confirmation. The loop, the executor and the
// tool are the real ones, and the pending confirmation lives on the turn rows the loop reads, as in the database.
import { assert, assertEquals, assertFalse } from "@std/assert";
import { z } from "zod";

import { executeTool } from "../_shared/assistant/executor.ts";
import { createRegistry } from "../_shared/assistant/registry.ts";
import { createFakeActionStore, userId } from "../_shared/assistant/testing.ts";
import { deleteWorkoutTool } from "../_shared/assistant/tools/deleteWorkout.ts";
import { thursdayId, workoutStub } from "../_shared/assistant/tools/deleteWorkoutFixtures.ts";
import { sessionRow } from "../_shared/assistant/tools/trainingFixtures.ts";
import { describeWorkoutInProgressRefusal } from "../_shared/core.ts";
import { createHarness, listed } from "./turnTesting.ts";

import type { ActionStore } from "../_shared/assistant/store.ts";
import type { ExecutionResult } from "../_shared/assistant/executor.ts";
import type { ToolCallResult } from "../_shared/assistant/mcpClient.ts";
import type { ToolContext } from "../_shared/assistant/tool.ts";
import type { AssistantStreamEvent } from "../_shared/core.ts";
import type { Harness, ScriptedResponse } from "./turnTesting.ts";

const question =
  "Delete your Legs workout from Thursday 8 October? It has 16 sets. They leave your history and your weekly numbers.";
const liveWorkoutId = "00000000-0000-4000-8000-0000000b0aaa";
const confirmLabel = "Delete workout";

const reply = (text: string): ScriptedResponse => ({
  blocks: [{ type: "text", text }],
  stopReason: "end_turn",
});

const callDelete = (
  id: string,
  input: { session_id: string; confirmation_id?: string | null },
  text?: string,
): ScriptedResponse => ({
  blocks: [
    ...(text === undefined ? [] : [{ type: "text" as const, text }]),
    { type: "tool_use", id, name: "delete_workout", input },
  ],
  stopReason: "tool_use",
});

// The fake store numbers its actions "action-1", and the app's card holds ids that are UUIDs.
const uuidOfAction = (actionId: string): string =>
  `00000000-0000-4000-8000-${actionId.replace(/\D/g, "").padStart(12, "0")}`;

function toToolCallResult(result: ExecutionResult): ToolCallResult {
  switch (result.status) {
    case "ok":
      return {
        text: result.text,
        isError: false,
        outcome: {
          status: "ok",
          structured: result.structured,
          actionId: result.actionId === null ? null : uuidOfAction(result.actionId),
        },
      };
    case "needs_confirmation":
      return {
        text: result.text,
        isError: false,
        outcome: {
          status: "needs_confirmation",
          confirmationId: result.confirmationId,
          question: result.question,
          ...(result.note === undefined ? {} : { note: result.note }),
          ...(result.asksAgain === true ? { asksAgain: true as const } : {}),
        },
      };
    case "error":
      return {
        text: result.text,
        isError: true,
        outcome: { status: "error", code: result.code },
      };
  }
}

const pendingSchema = z.object({
  id: z.string(),
  tool: z.string(),
  input_hash: z.string(),
  confirm_label: z.string().nullable(),
});

// The action store of the executor, with its pending confirmation kept on the harness's turn rows, which is where
// the turn loop reads it. Slots and targets are the fake store's.
function storeOnTurnRows(harness: () => Harness): ActionStore {
  const turnRow = (id: string) =>
    harness()
      .turnRows()
      .find((row) => row["id"] === id);
  return {
    ...createFakeActionStore(),
    storePendingConfirmation(turnId, _user, confirmation) {
      const row = turnRow(turnId);
      if (row !== undefined) {
        row["pending_confirmation"] = {
          id: confirmation.id,
          tool: confirmation.tool,
          input_hash: confirmation.inputHash,
          confirm_label: confirmation.confirmLabel,
        };
      }
      return Promise.resolve();
    },
    previousPendingConfirmation(_conversation, _user, currentTurnId) {
      const rows = harness().turnRows();
      const previous = rows[rows.findIndex((row) => row["id"] === currentTurnId) - 1];
      const pending = pendingSchema.safeParse(previous?.["pending_confirmation"]);
      if (previous === undefined || !pending.success) {
        return Promise.resolve(null);
      }
      const { id, tool, input_hash: inputHash, confirm_label: label } = pending.data;
      return Promise.resolve({
        turnId: String(previous["id"]),
        confirmation: { id, tool, inputHash, confirmLabel: label },
      });
    },
    spendPendingConfirmation(turnId, _user, confirmationId) {
      const row = turnRow(turnId);
      const pending = pendingSchema.safeParse(row?.["pending_confirmation"]);
      if (row === undefined || !pending.success || pending.data.id !== confirmationId) {
        return Promise.resolve(false);
      }
      row["pending_confirmation"] = null;
      return Promise.resolve(true);
    },
  };
}

// A person's conversation with the real `delete_workout` behind the loop. `say` sends one message.
async function conversation(responses: ScriptedResponse[]) {
  const stub = workoutStub();
  let current: Harness | null = null;
  const harnessOf = (): Harness => {
    assert(current !== null);
    return current;
  };
  let words = "";
  const actions = storeOnTurnRows(harnessOf);
  const registry = createRegistry([deleteWorkoutTool]);
  const executorContext = (): ToolContext => {
    const turn = harnessOf().turnRows().at(-1);
    return {
      caller: stub.caller,
      actions,
      previousValueOf: (action) => actions.previousValueOf(action, userId),
      userId,
      turn: {
        id: String(turn?.["id"]),
        conversationId: harnessOf().conversationId,
        userMessageText: words,
        personsWords: words,
        localDate: "2026-11-03",
        localTime: null,
      },
      registry,
      allowedTools: new Set(["delete_workout"]),
      reportError: () => {},
    };
  };
  current = await createHarness({
    responses,
    tools: [listed("delete_workout", false, { session_id: { type: "string" } }, false)],
    answers: {
      delete_workout: async (input) =>
        toToolCallResult(await executeTool(executorContext(), "delete_workout", input)),
    },
  });
  const harness = current;
  return {
    harness,
    stub,
    actions,
    async say(text: string) {
      words = text;
      const result = await harness.take(text);
      // The fake database gives every row the same `created_at`, so "the previous turn" would always be the first
      // one. The database gives each turn its own moment, and the loop and the executor both read by it.
      harness.turnRows().forEach((row, turnNumber) => {
        row["created_at"] = new Date(Date.UTC(2026, 10, 3, 12, 0, turnNumber)).toISOString();
      });
      return result;
    },
    startWorkout() {
      stub.tables["workout_sessions"]?.push(
        sessionRow(9, { id: liveWorkoutId, ended_at: null, workout_sets: [] }),
      );
    },
    finishWorkout() {
      const live = stub.tables["workout_sessions"]?.find((row) => row["id"] === liveWorkoutId);
      Object.assign(live ?? {}, { ended_at: "2026-11-03T13:00:00+00:00" });
    },
    deletions: () => stub.calls.filter(({ method }) => method === "rpc").length,
    thursdayDeleted: () =>
      stub.tables["workout_sessions"]?.find((row) => row["id"] === thursdayId)?.["deleted_at"] !==
      null,
    pendingOf: (turnNumber: number) =>
      pendingSchema.safeParse(harness.turnRows()[turnNumber]?.["pending_confirmation"]),
    close: () => harness.shutdown(),
  };
}

const typesOf = (events: readonly AssistantStreamEvent[]) =>
  events.map((event) => event.type).filter((type) => type !== "status");
const textOf = (events: readonly AssistantStreamEvent[]) =>
  events.flatMap((event) => (event.type === "text" ? [event.delta] : [])).join("");
const cardTitlesOf = (events: readonly AssistantStreamEvent[]) =>
  events.flatMap((event) => (event.type === "card" ? [event.card.title] : []));

Deno.test(
  "a press refused for a workout gets the fixed words and Ask again, and keeps the confirmation unspent",
  async () => {
    const chat = await conversation([callDelete("d1", { session_id: thursdayId }, question)]);
    try {
      await chat.say("Delete my Legs workout from last Thursday");
      const asked = chat.pendingOf(0);
      assert(asked.success && asked.data.confirm_label === confirmLabel);
      chat.startWorkout();

      const pressed = await chat.say(confirmLabel);

      assertEquals(typesOf(pressed.events), ["turn", "text", "ask_again", "done"]);
      assertEquals(textOf(pressed.events), describeWorkoutInProgressRefusal());
      assertEquals(chat.harness.mock.bodies.length, 1);
      assertEquals(chat.deletions(), 0);
      // Not spent, and no new one stored by the refusal.
      assertEquals(chat.pendingOf(0).success, true);
      assertEquals(chat.pendingOf(1).success, false);
    } finally {
      await chat.close();
    }
  },
);

Deno.test(
  "after Ask again once the workout ends, the stored confirmation is no longer the previous turn's, so the model asks again and nothing is written until the new press",
  async () => {
    const chat = await conversation([
      callDelete("d1", { session_id: thursdayId }, question),
      // The model of the Ask again turn calls the tool again, with no confirmation id, as a fresh request.
      callDelete("d2", { session_id: thursdayId, confirmation_id: null }, question),
    ]);
    try {
      await chat.say("Delete my Legs workout from last Thursday");
      chat.startWorkout();
      await chat.say(confirmLabel);
      chat.finishWorkout();

      // Ask again: the same words as the button, sent as a message, with the refused press the previous turn.
      const askedAgain = await chat.say(confirmLabel);

      assertEquals(chat.harness.mock.bodies.length, 2);
      assertEquals(chat.deletions(), 0);
      assertFalse(chat.thursdayDeleted());
      assertEquals(askedAgain.events.at(-1), { type: "done", outcome: "confirm" });
      assertEquals(cardTitlesOf(askedAgain.events), []);
      const again = chat.pendingOf(2);
      assert(again.success && again.data.confirm_label === confirmLabel);

      const pressed = await chat.say(confirmLabel);

      // The press of the new question is the one that writes, with no model call.
      assertEquals(chat.harness.mock.bodies.length, 2);
      assertEquals(chat.deletions(), 1);
      assertEquals(chat.thursdayDeleted(), true);
      assertEquals(cardTitlesOf(pressed.events), ["Deleted workout Legs"]);
    } finally {
      await chat.close();
    }
  },
);

Deno.test(
  "a model that sends a confirmation id on the Ask again turn is refused as confirmation_invalid and writes nothing",
  async () => {
    const chat = await conversation([
      callDelete("d1", { session_id: thursdayId }, question),
      // Replays the call with an id it was given earlier, which is what a model may copy from its history.
      callDelete("d2", {
        session_id: thursdayId,
        confirmation_id: "00000000-0000-4000-8000-0000000000c9",
      }),
      reply("That did not go through. Ask me again."),
    ]);
    try {
      await chat.say("Delete my Legs workout from last Thursday");
      chat.startWorkout();
      await chat.say(confirmLabel);
      chat.finishWorkout();

      const result = await chat.say(confirmLabel);

      assertEquals(chat.deletions(), 0);
      assertFalse(chat.thursdayDeleted());
      assertEquals(cardTitlesOf(result.events), []);
      // The model was told why, in a code and no wording.
      assertEquals(chat.harness.mock.bodies.at(-1)?.includes("confirmation_invalid"), true);
    } finally {
      await chat.close();
    }
  },
);

Deno.test(
  "a request refused by the model's own call during a workout, then Ask again after it ends, asks and then writes only on the press",
  async () => {
    const chat = await conversation([
      callDelete("d1", { session_id: thursdayId, confirmation_id: null }),
      reply("Your Legs workout is in progress, so nothing in your training can change yet."),
      callDelete("d2", { session_id: thursdayId, confirmation_id: null }, question),
    ]);
    try {
      chat.startWorkout();
      const refused = await chat.say("Delete my Legs workout from last Thursday");

      assertEquals(typesOf(refused.events).at(-2), "ask_again");
      assertEquals(chat.deletions(), 0);
      chat.finishWorkout();
      const asked = await chat.say(confirmLabel);

      assertEquals(asked.events.at(-1), { type: "done", outcome: "confirm" });
      assertEquals(chat.deletions(), 0);
      assertFalse(chat.thursdayDeleted());

      await chat.say(confirmLabel);

      assertEquals(chat.deletions(), 1);
      assertEquals(chat.thursdayDeleted(), true);
    } finally {
      await chat.close();
    }
  },
);
