// Three cases of the write set for the training part of the prompt (KEY-908). Two are a training change asked for
// during a workout. The executor refuses
// every training write while a workout is in progress, and after that the words are the model's own, so these
// cases check what the person is left knowing. KEY-911 owns the full set of edit cases, so only these are here.
//
// Both start a workout in `setup` and discard it in `cleanUp`, as the training advice cases do, and a reply is
// graded only for what a right reply cannot avoid saying: that the workout is the reason, and (when the turn
// also wrote something) which change was not made. Its wording is never graded.
import { threadFromMessages } from "@keylow/core";

import { READ_TOOLS } from "./ask.ts";
import {
  actionRows,
  askedOnce,
  calledWith,
  cardOfKind,
  noActionRowsInTurn,
  onlyTheseTools,
  rowCount,
  turnEnded,
  undoWrites,
  withContext,
} from "./entryGraders.ts";
import { workoutUntouched } from "./trainingAdviceGraders.ts";
import { toolCalled } from "../src/case.ts";
import { LIVE_WORKOUT } from "../src/trainingWorld.ts";
import { trainingWorldHolder } from "../src/trainingWorldHolder.ts";

import type { EvalCase, Grader } from "../src/case.ts";

const pass = (reason: string) => ({ passed: true, reason });
const fail = (reason: string) => ({ passed: false, reason });

/** Passes when the last answer matches every pattern, each one named by its description. */
function answerSays(
  ...sayings: readonly (readonly [pattern: RegExp, description: string])[]
): Grader {
  return ({ turns }) => {
    const answer = turns.at(-1)?.answer ?? "";
    const missing = sayings.find(([pattern]) => !pattern.test(answer));
    return Promise.resolve(
      missing === undefined
        ? pass("the answer says what a person needs to know")
        : fail(`the answer does not ${missing[1]}`),
    );
  };
}

const roleOf = (value: unknown): "user" | "assistant" | null =>
  value === "user" || value === "assistant" ? value : null;

/**
 * Passes when the thread the person sees for the turn does (or does not) hold an Ask again. It is built from
 * the stored rows by core's own thread builder, because the executor stores `askAgain` on the first refusal
 * whatever else landed in the turn and core decides what is drawn: a turn that also wrote something shows none
 * (pressing it would send the whole message again and could log twice, KEY-902), and a turn that only
 * refused shows one.
 */
export function askAgainShown(turnIndex: number, shown: boolean): Grader {
  return async ({ turns, database }) => {
    const turn = turns[turnIndex];
    if (turn === undefined) {
      return fail(`the case has no turn ${turnIndex + 1}`);
    }
    const rows = await database.readRows({
      table: "assistant_messages",
      where: { turn_id: turn.turnId },
    });
    const messages = [...rows]
      .sort((left, right) => Number(left["seq"]) - Number(right["seq"]))
      .flatMap((row) => {
        const { id } = row;
        const role = roleOf(row["role"]);
        return typeof id === "string" && role !== null
          ? [
              {
                id,
                turnId: turn.turnId,
                role,
                content: row["content"],
                display: row["display"],
                turnStatus: turn.status,
              },
            ]
          : [];
      });
    const drawn = threadFromMessages(messages, []).some(({ kind }) => kind === "ask_again");
    if (messages.length === 0) {
      return fail("the turn has no stored messages to build the thread from");
    }
    return drawn === shown
      ? pass(shown ? "the thread shows Ask again" : "the thread shows no Ask again")
      : fail(shown ? "the thread shows no Ask again" : "the thread shows an Ask again");
  };
}

const WORKOUT_REFUSAL_TOOLS: ReadonlySet<string> = new Set([
  ...READ_TOOLS,
  "log_entry",
  "edit_routine",
  "update_training_goals",
]);

const startsAWorkout: Pick<EvalCase, "prepare" | "setup"> = {
  // The history holds the exercises the workout is made of, and is written once for every case.
  prepare: () => trainingWorldHolder.current().ensureHistory(),
  setup: async () => {
    await trainingWorldHolder.current().startWorkout();
    return null;
  },
};

const discardsTheWorkout: NonNullable<EvalCase["cleanUp"]> = async (turns, environment) => {
  // Both are done whatever the other did, so a failed Undo does not leave a workout open for the next case.
  const failures: unknown[] = [];
  for (const step of [
    () => trainingWorldHolder.current().discardWorkout(),
    () => undoWrites(turns, environment),
  ]) {
    try {
      await step();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures[0] !== undefined) {
    throw failures[0] instanceof Error ? failures[0] : new Error("clean up failed");
  }
};

const mentionsTheWorkout = [/workout/i, "mention the workout"] as const;

/**
 * The cases, for a first message that logs two large eggs on the scratch day `eggsDay` and swaps one exercise
 * of the eval user's routine for another. Both are named in full and are in the fixtures, so a fair model has
 * nothing to ask about and the case cannot pass without the eggs logged.
 */
export function trainingPromptCasesOf(eggsDay: string, eggsMessage: string): readonly EvalCase[] {
  const swapMessages: EvalCase["messages"] = [eggsMessage];
  const goalMessages: EvalCase["messages"] = ["Set my training days to 5 a week."];

  const loggedAndSwapRefused: readonly Grader[] = [
    turnEnded(0, "complete"),
    actionRows("log_entry", 1, [0]),
    cardOfKind(0, "logged"),
    rowCount({ table: "food_log_entries", where: { local_date: eggsDay, deleted_at: null } }, 1),
    // The swap was refused, so nothing was written to the routine, and the workout is as it was.
    actionRows("edit_routine", 0, [0]),
    workoutUntouched(LIVE_WORKOUT.sets),
    // The turn wrote, so the person sees no Ask again, and the reply is what tells them what waits.
    askAgainShown(0, false),
    answerSays(mentionsTheWorkout, [/swap|pushdown|curl/i, "name the swap that was not made"]),
  ];

  return [
    {
      id: "workout-log-eggs-and-swap-an-exercise",
      set: "writes",
      ...startsAWorkout,
      messages: swapMessages,
      expect: [...loggedAndSwapRefused, onlyTheseTools(WORKOUT_REFUSAL_TOOLS)].map((grade) =>
        withContext(grade, swapMessages),
      ),
      cleanUp: discardsTheWorkout,
    },
    {
      id: "workout-change-the-training-days",
      set: "writes",
      ...startsAWorkout,
      messages: goalMessages,
      expect: [
        turnEnded(0, "complete"),
        toolCalled("update_training_goals"),
        noActionRowsInTurn(0),
        workoutUntouched(LIVE_WORKOUT.sets),
        // The turn only refused, so the person is offered Ask again.
        askAgainShown(0, true),
        answerSays(mentionsTheWorkout, [/train tab/i, "point to the Train tab"]),
        onlyTheseTools(WORKOUT_REFUSAL_TOOLS),
      ].map((grade) => withContext(grade, goalMessages)),
      cleanUp: discardsTheWorkout,
    },
    noGoalBuildCase,
  ];
}

// A build asked for by a person with no training goal: the reply is one question with quick replies and nothing
// is written. The second half (their answer saved with `update_training_goals`, then the build) writes a goal
// that the other sets would then read, and goals are history rows that `restoreGoal` cannot put back, so it
// is not played here.
const noGoalMessages: EvalCase["messages"] = ["Build me a 3 day routine called Scratch no goal."];

const noGoalBuildCase: EvalCase = {
  id: "build-a-routine-with-no-goal-asks-for-it",
  set: "writes",
  prepare: () => trainingWorldHolder.current().ensureHistory(),
  setup: async () => {
    await trainingWorldHolder.current().clearGoal();
    return null;
  },
  messages: noGoalMessages,
  expect: [
    turnEnded(0, "clarify"),
    askedOnce(),
    calledWith(
      "ask_user",
      ({ quick_replies: replies }) =>
        Array.isArray(replies) && replies.length >= 1 && replies.length <= 3,
      "1 to 3 quick replies",
    ),
    // Only reads: no routine is built and no goal is saved before the person has answered.
    noActionRowsInTurn(0),
    onlyTheseTools(READ_TOOLS),
  ].map((grade) => withContext(grade, noGoalMessages)),
  cleanUp: () => trainingWorldHolder.current().restoreGoal(),
};
