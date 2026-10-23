import type { SetupDraft } from "./types";

export const SETUP_STEPS = [
  "sex",
  "birthDate",
  "body",
  "activity",
  "goal",
  "rate",
  "protein",
  "diet",
  "estimate",
] as const;

export type SetupStep = (typeof SETUP_STEPS)[number];

/** Whether the user is asked this step. Only the rate is ever skipped, and only for the maintain goal. */
const isShown = (answers: SetupDraft, step: SetupStep): boolean =>
  !(step === "rate" && answers.goal === "maintain");

const shownSteps = (answers: SetupDraft): SetupStep[] =>
  SETUP_STEPS.filter((step) => isShown(answers, step));

/** The step after `step`, or undefined after the estimate. */
export function nextStep(answers: SetupDraft, step: SetupStep): SetupStep | undefined {
  return SETUP_STEPS.slice(SETUP_STEPS.indexOf(step) + 1).find((later) => isShown(answers, later));
}

/** The step before `step`, or undefined before the first. */
export function previousStep(answers: SetupDraft, step: SetupStep): SetupStep | undefined {
  return SETUP_STEPS.slice(0, SETUP_STEPS.indexOf(step))
    .reverse()
    .find((earlier) => isShown(answers, earlier));
}

/** How many questions the progress indicator counts: 8, or 7 when maintain skips the rate. The estimate is not one. */
export function stepCount(answers: SetupDraft): number {
  return shownSteps(answers).length - 1;
}

/**
 * The 1-based position of a question among the questions shown, for "Step n of 8". The estimate is not
 * a question and a skipped rate step is not shown, so neither has a number.
 */
export function stepNumber(answers: SetupDraft, step: SetupStep): number | undefined {
  const position = shownSteps(answers).indexOf(step) + 1;
  return step === "estimate" || position === 0 ? undefined : position;
}

/**
 * How full the progress bar is at `step`, between 0 and 1 and not rounded. The estimate stands one
 * stop after the last question, so a question's fraction is its number over the count plus one, and
 * the estimate itself is full. A skipped rate step has the fraction of the question before it.
 */
export function progressFraction(answers: SetupDraft, step: SetupStep): number {
  if (step === "estimate") {
    return 1;
  }
  const questionsUpToStep = SETUP_STEPS.slice(0, SETUP_STEPS.indexOf(step) + 1).filter((earlier) =>
    isShown(answers, earlier),
  ).length;
  return questionsUpToStep / (stepCount(answers) + 1);
}
