// Changes the person's training goals, as the Goal screen does, with a card and Undo. The model sends the
// answers it was given and null for the rest, and the rest stay as the person has them. A person with no
// goal yet is asked for their goal and experience only, and the other four answers start from core's
// `GOAL_STARTING_ANSWERS`, which the card says (KEY-904). The muscle priorities and the presets version come
// from core inside `saveTrainingGoalsReturningId`, so the model never sends them.
//
// `training_goals` is versioned: a save ends the current row and adds the next. So the action names the new
// row and stores no value, and Undo reads the row before it and saves its answers again, or ends the row when
// there was none. A goal is health data: nothing here puts an answer in a log or an error.
import { z } from "zod";

import {
  EQUIPMENT,
  EXPERIENCE_LEVELS,
  GOAL_STARTING_ANSWERS,
  MAX_DAYS_PER_WEEK,
  MAX_SESSION_MINUTES,
  MIN_DAYS_PER_WEEK,
  MIN_SESSION_MINUTES,
  TRAINING_FOCUSES,
  TRAINING_GOALS,
  buildGoalsUpdatedCard,
  changedGoalAnswers,
  goalAnswersOfRow,
} from "../../core.ts";
import {
  closeTrainingGoals,
  getCurrentTrainingGoals,
  listTrainingGoalsHistory,
  saveTrainingGoalsReturningId,
} from "../../repos.ts";

import type { GoalAnswerGiven, GoalAnswers } from "../../core.ts";
import type { WriteRunOutput, WriteToolDefinition } from "../tool.ts";

const hasNoRepeats = (values: readonly string[]): boolean => new Set(values).size === values.length;

const updateTrainingGoalsInput = z.strictObject({
  goal: z
    .enum(TRAINING_GOALS)
    .nullable()
    .describe("aesthetic is Look better, strength is Get stronger, hybrid is Both."),
  focus: z
    .array(z.enum(TRAINING_FOCUSES))
    .refine(hasNoRepeats)
    .nullable()
    .describe("The areas to focus on, each at most once, or an empty list for none."),
  days_per_week: z.number().int().min(MIN_DAYS_PER_WEEK).max(MAX_DAYS_PER_WEEK).nullable(),
  session_minutes: z
    .number()
    .int()
    .min(MIN_SESSION_MINUTES)
    .max(MAX_SESSION_MINUTES)
    .nullable()
    .describe("How long a session is, in minutes."),
  equipment: z
    .array(z.enum(EQUIPMENT))
    .min(1)
    .refine(hasNoRepeats)
    .nullable()
    .describe("What the user can use, at least one. A full gym is every value but other."),
  experience: z.enum(EXPERIENCE_LEVELS).nullable(),
});

type UpdateTrainingGoalsInput = z.infer<typeof updateTrainingGoalsInput>;

// What to do with a call: ask for what a first goal lacks, save nothing because nothing would change, or
// save. `given` is the answers of a first goal that the person gave besides the goal and experience.
type Plan =
  | { outcome: "needs"; needs: ("goal" | "experience")[] }
  | { outcome: "unchanged" }
  | {
      outcome: "save";
      before: GoalAnswers | null;
      after: GoalAnswers;
      changed: (keyof GoalAnswers)[];
      given: GoalAnswerGiven[];
    };

const overlay = (input: UpdateTrainingGoalsInput, base: GoalAnswers): GoalAnswers => ({
  goal: input.goal ?? base.goal,
  focus: input.focus ?? [...base.focus],
  days_per_week: input.days_per_week ?? base.days_per_week,
  session_minutes: input.session_minutes ?? base.session_minutes,
  equipment: input.equipment ?? [...base.equipment],
  experience: input.experience ?? base.experience,
});

const givenOf = (input: UpdateTrainingGoalsInput): GoalAnswerGiven[] => [
  ...(input.focus === null ? [] : ["focus" as const]),
  ...(input.days_per_week === null ? [] : ["days_per_week" as const]),
  ...(input.session_minutes === null ? [] : ["session_minutes" as const]),
  ...(input.equipment === null ? [] : ["equipment" as const]),
];

function planOf(
  input: UpdateTrainingGoalsInput,
  current: Parameters<typeof goalAnswersOfRow>[0] | null,
): Plan {
  if (current !== null) {
    const before = goalAnswersOfRow(current);
    const after = overlay(input, before);
    const changed = changedGoalAnswers(before, after);
    return changed.length === 0
      ? { outcome: "unchanged" }
      : { outcome: "save", before, after, changed, given: [] };
  }
  const { goal, experience } = input;
  if (goal === null || experience === null) {
    return {
      outcome: "needs",
      needs: [
        ...(goal === null ? ["goal" as const] : []),
        ...(experience === null ? ["experience" as const] : []),
      ],
    };
  }
  const after = overlay(input, { ...GOAL_STARTING_ANSWERS, goal, experience });
  return {
    outcome: "save",
    before: null,
    after,
    changed: ["goal", "experience"],
    given: givenOf(input),
  };
}

const sameInstant = (first: string, second: string): boolean =>
  Date.parse(first) === Date.parse(second);

export const updateTrainingGoalsTool: WriteToolDefinition<UpdateTrainingGoalsInput> = {
  name: "update_training_goals",
  description:
    "Changes the user's training goals, with a card and Undo: their goal, focus, days a week, session " +
    "minutes, equipment and experience. Send only what the user asked to change and null for every other " +
    "field, because a null leaves that answer as it is. Send a list in full: focus [] clears the focus, " +
    "and equipment needs at least one value. Never send muscle priorities, Ki-Lo works them out. This " +
    "changes how Ki-Lo suggests sessions and leaves their routines as they are. Nothing is asked first, " +
    "because the earlier goals are kept and Undo puts them back. A user with no goals yet needs a goal and " +
    "an experience. If either is missing the call saves nothing and answers needs with the names: ask the " +
    "user with ask_user and never guess. Ki-Lo then starts the rest itself, with no focus, a full gym, 60 " +
    "minutes, and the days the user named or 3, so send days_per_week when the user named a number of " +
    'days ("a 3 day routine" is 3) and leave the other three null unless they named them. The card says ' +
    "what Ki-Lo started with. A call that changes nothing saves nothing and shows no card. This is " +
    "refused while a workout is in progress.",
  kind: "write",
  // Six nullable fields would use most of the 16 union parameters a request may hold across its strict
  // tools, so this tool opts out. The executor checks every input with the same schema.
  strict: false,
  input: updateTrainingGoalsInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  targetTable: "training_goals",
  refusesDuringWorkout: true,
  async run(ctx, input): Promise<WriteRunOutput> {
    const plan = planOf(input, await getCurrentTrainingGoals(ctx.caller));
    if (plan.outcome === "needs") {
      return { data: { needs: plan.needs }, target: null };
    }
    if (plan.outcome === "unchanged") {
      return { data: { saved: false, unchanged: true }, target: null };
    }
    const { before, after, changed, given } = plan;
    // Built before the write, because a card that cannot be built must not be found out after the goal is saved.
    const card = buildGoalsUpdatedCard(
      before === null ? { before, after, given } : { before, after },
    );
    // Reads nothing back, so once the goal is saved there is nothing left that can throw.
    const savedId = await saveTrainingGoalsReturningId(ctx.caller, after);
    return {
      data: {
        saved: true,
        first_goal: before === null,
        changed,
        ...(before === null
          ? {
              also_set: (["days_per_week", "session_minutes", "equipment"] as const).filter(
                (key) => !given.includes(key),
              ),
            }
          : {}),
      },
      structured: { card },
      target: { targetId: savedId },
    };
  },
  // Puts the goal as it was, unless the person has changed it since. The row the call saved must still be
  // the current one. The row before it is the one that ended at the instant it began, and its answers are
  // saved again as a new row. When there is none, the call made the person's first goal, and the row ends.
  async inverse(ctx, action) {
    const history = await listTrainingGoalsHistory(ctx.caller);
    const current = history.find((goal) => goal.effective_to === null);
    if (current === undefined || current.id !== action.targetId) {
      return { status: "unavailable", reason: "changed" };
    }
    const previous = history.find(
      ({ effective_to }) =>
        effective_to !== null && sameInstant(effective_to, current.effective_from),
    );
    if (previous === undefined) {
      return (await closeTrainingGoals(ctx.caller, current))
        ? "undone"
        : { status: "unavailable", reason: "changed" };
    }
    await saveTrainingGoalsReturningId(ctx.caller, goalAnswersOfRow(previous));
    return "undone";
  },
};
