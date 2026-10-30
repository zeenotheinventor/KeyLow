import { goalAnswersSchema } from "@keylow/core/training";

import type { GoalAnswers } from "@keylow/core/training";

/** Answers to some of the questions, such as the current goal's to open the flow filled. */
export type GoalDraftAnswers = Partial<GoalAnswers>;

/**
 * The answers given so far. A question not answered yet has no key, except the focus, which starts empty
 * because the schema allows an empty focus: a strength user may choose none.
 */
export type GoalDraft = GoalDraftAnswers & Pick<GoalAnswers, "focus">;

/** Gives answers, each replacing any earlier answer to its question. */
export type GoalDraftAction = Readonly<{ type: "answered"; answers: GoalDraftAnswers }>;

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
  return key !== undefined && goalAnswersSchema.shape[key].safeParse(draft[key]).success;
}

/** Whether any question holds an answer, which is what closing the questionnaire would lose. An empty focus is none. */
export function hasGoalAnswers(draft: GoalDraft): boolean {
  const { focus, ...otherAnswers } = draft;
  return focus.length > 0 || Object.keys(otherAnswers).length > 0;
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
