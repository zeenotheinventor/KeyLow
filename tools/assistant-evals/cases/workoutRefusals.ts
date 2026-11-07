// Two cases of the write set for a training change asked for during a workout (KEY-908). The executor refuses
// every training write while a workout is in progress, and after that the words are the model's own, so these
// cases check what the person is left knowing. KEY-911 owns the full set of edit cases, so only these are here.
//
// Both start a workout in `setup` and discard it in `cleanUp`, as the training advice cases do, and a reply is
// graded only for what a right reply cannot avoid saying: that the workout is the reason, and (when the turn
// also wrote something) which change was not made. Its wording is never graded.
import { READ_TOOLS } from "./ask.ts";
import {
  actionRows,
  anyOfRoutes,
  askedOnce,
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

/**
 * Passes when no `ask_again` was stored for the turn. A turn that wrote something and was also refused for a
 * workout shows no Ask again, because pressing it would send the whole message again and could log twice
 * (KEY-902). The executor stores `display[<tool_use_id>] = { askAgain: true }` on the turn's messages.
 */
function noAskAgainStored(turnIndex: number): Grader {
  return async ({ turns, database }) => {
    const turn = turns[turnIndex];
    if (turn === undefined) {
      return fail(`the case has no turn ${turnIndex + 1}`);
    }
    const rows = await database.readRows({
      table: "assistant_messages",
      where: { turn_id: turn.turnId },
    });
    return rows.some(({ display }) =>
      /askAgain\\?"\s*:\s*true/.test(JSON.stringify(display ?? null)),
    )
      ? fail("an Ask again was stored for a turn that also wrote")
      : pass("no Ask again was stored");
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
 * The cases, for a first message that logs two large eggs on the scratch day `eggsDay` and swaps an exercise.
 * The swap names the exercises in full, because a fair model asks which incline press when it is not told.
 */
export function workoutRefusalCasesOf(eggsDay: string, eggsMessage: string): readonly EvalCase[] {
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
    noAskAgainStored(0),
    // The reply is the only thing that tells the person what waits: it names the swap and the workout.
    answerSays(mentionsTheWorkout, [/swap|incline|bench/i, "name the swap that was not made"]),
  ];
  // Asking which incline exercise is fair when the message leaves it open, and then nothing is written.
  const askedWhichExercise: readonly Grader[] = [
    askedOnce(),
    noActionRowsInTurn(0),
    workoutUntouched(LIVE_WORKOUT.sets),
  ];

  return [
    {
      id: "workout-log-eggs-and-swap-an-exercise",
      set: "writes",
      ...startsAWorkout,
      messages: swapMessages,
      expect: [
        anyOfRoutes([loggedAndSwapRefused, askedWhichExercise]),
        onlyTheseTools(WORKOUT_REFUSAL_TOOLS),
      ].map((grade) => withContext(grade, swapMessages)),
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
        answerSays(mentionsTheWorkout),
        onlyTheseTools(WORKOUT_REFUSAL_TOOLS),
      ].map((grade) => withContext(grade, goalMessages)),
      cleanUp: discardsTheWorkout,
    },
  ];
}
