import { describeSetupStepLabel, SETUP_SHELL } from "@keylow/core/copy";
import { ageInYears } from "@keylow/core/dates";
import {
  checkBirthDate,
  nextStep,
  previousStep,
  progressFraction,
  resetGoalForAge,
  stepCount,
  stepNumber,
} from "@keylow/core/setup";

import type { Sex } from "@keylow/core/engine";
import type { SetupDraft, SetupStep } from "@keylow/core/setup";

/**
 * The answers so far and the step the person is on. `hasLoadedSavedAnswers` is true once the saved answers
 * have joined the draft, which happens once. `hasEditedBirthDate` is true once the person has typed in the
 * birth date fields, so a saved birth date that arrives later does not come in under what they typed.
 */
export type SetupWizardState = Readonly<{
  draft: SetupDraft;
  step: SetupStep;
  hasLoadedSavedAnswers: boolean;
  hasEditedBirthDate: boolean;
}>;

/**
 * `today` is a `YYYY-MM-DD` in the device's time zone. A birth date is only ever handed over once it
 * passes `checkBirthDate`, and `undefined` says the fields no longer hold one.
 */
export type SetupWizardAction =
  | Readonly<{ type: "sexChosen"; sex: Sex }>
  | Readonly<{ type: "birthDateChanged"; birthDate: string | undefined; today: string }>
  | Readonly<{ type: "savedAnswersLoaded"; saved: SetupDraft; today: string }>
  | Readonly<{ type: "continued"; today: string }>
  | Readonly<{ type: "wentBack" }>;

export const initialSetupWizardState: SetupWizardState = {
  draft: {},
  step: "sex",
  hasLoadedSavedAnswers: false,
  hasEditedBirthDate: false,
};

/**
 * Whether the person has answered this step so that Continue is live. A step that is not built yet has
 * no way to be answered, so it is not complete.
 */
export function isStepComplete(draft: SetupDraft, step: SetupStep, today: string): boolean {
  switch (step) {
    case "sex":
      return draft.sex !== undefined;
    case "birthDate":
      return draft.birthDate !== undefined && checkBirthDate(draft.birthDate, today).ok;
    default:
      return false;
  }
}

function withBirthDate(
  draft: SetupDraft,
  birthDate: string | undefined,
  today: string,
): SetupDraft {
  if (birthDate === undefined) {
    const withoutBirthDate = { ...draft };
    delete withoutBirthDate.birthDate;
    return withoutBirthDate;
  }
  // A Lose goal chosen before this birth date made the person under 18 is no longer offered.
  return resetGoalForAge({ ...draft, birthDate }, ageInYears(birthDate, today));
}

/**
 * Once only, so a later read cannot undo what the person did since. What they answered while the saved
 * answers were loading wins, and so does a birth date they have typed even if it is not usable yet. The
 * goal is then checked against the birth date that stands, so a saved Lose cannot outlive a birth date
 * that makes the person under 18.
 */
function withSavedAnswers(
  state: SetupWizardState,
  { saved, today }: Extract<SetupWizardAction, { type: "savedAnswersLoaded" }>,
): SetupWizardState {
  const savedToUse = { ...saved };
  if (state.hasEditedBirthDate) {
    delete savedToUse.birthDate;
  }
  const merged: SetupDraft = { ...savedToUse, ...state.draft };
  const draft =
    merged.birthDate === undefined
      ? merged
      : resetGoalForAge(merged, ageInYears(merged.birthDate, today));
  return { ...state, draft, hasLoadedSavedAnswers: true };
}

export function setupWizardReducer(
  state: SetupWizardState,
  action: SetupWizardAction,
): SetupWizardState {
  switch (action.type) {
    case "sexChosen":
      return { ...state, draft: { ...state.draft, sex: action.sex } };
    case "birthDateChanged":
      return {
        ...state,
        draft: withBirthDate(state.draft, action.birthDate, action.today),
        hasEditedBirthDate: true,
      };
    case "savedAnswersLoaded":
      return state.hasLoadedSavedAnswers ? state : withSavedAnswers(state, action);
    case "continued": {
      const step = nextStep(state.draft, state.step);
      return step === undefined || !isStepComplete(state.draft, state.step, action.today)
        ? state
        : { ...state, step };
    }
    case "wentBack": {
      const step = previousStep(state.draft, state.step);
      return step === undefined ? state : { ...state, step };
    }
  }
}

/** The header's subtitle, the progress bar's name and how full the bar is, from 0 to 100. */
export type SetupStepProgress = Readonly<{
  /** "Step 3 of 8". The estimate is not a question, so it has none. */
  subtitle: string | undefined;
  progressName: string;
  percent: number;
}>;

export function describeStepProgress(draft: SetupDraft, step: SetupStep): SetupStepProgress {
  const number = stepNumber(draft, step);
  const percent = progressFraction(draft, step) * 100;
  if (number === undefined) {
    return { subtitle: undefined, progressName: SETUP_SHELL.setupCompleteName, percent };
  }
  const label = describeSetupStepLabel(number, stepCount(draft));
  return { subtitle: label, progressName: label, percent };
}
