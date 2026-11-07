import { goalAnswersSchema } from "./goalAnswers";
import { FULL_GYM } from "../copy/goals";

import type { GoalAnswers } from "./goalAnswers";
import type { TrainingGoalsRow } from "../schemas";

/**
 * Answers to some of the questions, such as the current goal's to open the flow filled. An answer given as
 * `undefined` is taken back, as the Other minutes field does when it is emptied.
 */
export type GoalDraftAnswers = {
  [Question in Exclude<keyof GoalAnswers, "focus">]?: GoalAnswers[Question] | undefined;
} & Partial<Pick<GoalAnswers, "focus">>;

/**
 * The answers given so far. A question not answered yet has no key, except the focus, which starts empty
 * because the schema allows an empty focus: a strength user may choose none.
 */
export type GoalDraft = Omit<GoalDraftAnswers, "focus"> & Pick<GoalAnswers, "focus">;

/** Gives answers, each replacing any earlier answer to its question. */
export type GoalDraftAction = Readonly<{ type: "answered"; answers: GoalDraftAnswers }>;

/** The questions whose answer is one value, compared as it is. */
const singleValueKeys = ["goal", "days_per_week", "session_minutes", "experience"] as const;

/** The question of each step, in the order the boards draw them. */
const answerKeyOfStep = [
  "goal",
  "focus",
  "days_per_week",
  "session_minutes",
  "equipment",
  "experience",
] as const satisfies readonly (keyof GoalAnswers)[];

/** The six answers of a stored goal and nothing else of the row, so the flow opens filled with them. */
export function goalAnswersOfRow(row: TrainingGoalsRow): GoalAnswers {
  return {
    goal: row.goal,
    focus: row.focus,
    days_per_week: row.days_per_week,
    session_minutes: row.session_minutes,
    equipment: row.equipment,
    experience: row.experience,
  };
}

/**
 * The four answers a first goal starts with when the person gave only their goal and experience, which is
 * what the assistant asks (KEY-904). The app has no defaults, as a question not answered has no key, so
 * these are named once here. The focus is empty, as `initialGoalDraft` starts it. The equipment is the Full
 * gym shortcut, because an empty list saves but leaves `suggestSession` nothing to pick from. The session is
 * the middle of the lengths the questionnaire offers, so it flags neither a short day nor a long one. The
 * days are three, which a person who named their own number replaces.
 */
export const GOAL_STARTING_ANSWERS: Readonly<Omit<GoalAnswers, "goal" | "experience">> = {
  focus: [],
  days_per_week: 3,
  session_minutes: 60,
  equipment: [...FULL_GYM.equipment],
};

/** The draft to start from: the answers given, if any, with an empty focus where none was. */
export function initialGoalDraft(answers: GoalDraftAnswers = {}): GoalDraft {
  return { ...answers, focus: [...(answers.focus ?? [])] };
}

export function goalDraftReducer(draft: GoalDraft, action: GoalDraftAction): GoalDraft {
  return { ...draft, ...action.answers };
}

/**
 * Whether the question of step 1 to 6 holds an answer the goal answers schema accepts, which is what
 * enables Next. The schema's own rule is the rule: an empty focus is answered, and 8 days a week is not.
 */
export function isGoalStepAnswered(draft: GoalDraft, step: number): boolean {
  const key = answerKeyOfStep[step - 1];
  if (key === undefined || !goalAnswersSchema.shape[key].safeParse(draft[key]).success) {
    return false;
  }
  // The schema allows no equipment, as a stored goal may have none, but the question needs one value.
  return key !== "equipment" || draft.equipment?.length !== 0;
}

const sameValues = <Value>(first: readonly Value[], second: readonly Value[]): boolean =>
  first.length === second.length && first.every((value) => second.includes(value));

/**
 * The questions whose answer differs between two goals, in the order the questions are asked. A list is
 * the same answer when it holds the same values, in any order, as it is in `hasGoalDraftChanged`.
 */
export function changedGoalAnswers(before: GoalAnswers, after: GoalAnswers): (keyof GoalAnswers)[] {
  return answerKeyOfStep.filter((key) => {
    const was = before[key];
    const now = after[key];
    return Array.isArray(was) && Array.isArray(now) ? !sameValues(was, now) : was !== now;
  });
}

/**
 * Whether the draft differs from the one the flow opened with, which is what closing the questionnaire
 * would lose. A draft untouched since it was filled from the current goal has lost nothing, and an empty
 * focus is no answer. Lists are the same when they hold the same values, in any order.
 */
export function hasGoalDraftChanged(draft: GoalDraft, opened: GoalDraft): boolean {
  const { focus, equipment, ...otherAnswers } = draft;
  const { focus: openedFocus, equipment: openedEquipment, ...openedOtherAnswers } = opened;
  const isEquipmentSame =
    equipment === undefined || openedEquipment === undefined
      ? equipment === openedEquipment
      : sameValues(equipment, openedEquipment);

  return (
    !sameValues(focus, openedFocus) ||
    !isEquipmentSame ||
    singleValueKeys.some((key) => otherAnswers[key] !== openedOtherAnswers[key])
  );
}

/**
 * The first step before `step` whose question is not answered, or `undefined` when every earlier one is.
 * A question reached with an earlier one open has no step under it for Back to return to.
 */
export function firstUnansweredStep(draft: GoalDraft, step: number): number | undefined {
  return Array.from({ length: step - 1 }, (_, index) => index + 1).find(
    (earlier) => !isGoalStepAnswered(draft, earlier),
  );
}
