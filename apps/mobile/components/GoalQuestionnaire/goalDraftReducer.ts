import { goalAnswersSchema } from "@keylow/core/training";

import type { GoalAnswers } from "@keylow/core/training";

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
