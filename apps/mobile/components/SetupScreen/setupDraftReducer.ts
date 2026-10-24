import { describeSetupStepLabel, SETUP_SHELL } from "@keylow/core/copy";
import { ageInYears } from "@keylow/core/dates";
import {
  checkBirthDate,
  checkHeightCm,
  DEFAULT_DIET_STYLE,
  DEFAULT_PROTEIN_PRESET,
  DEFAULT_RATE_PCT_PER_WEEK,
  goalsAllowed,
  heightUnitFor,
  isRateGoal,
  nearestRatePreset,
  nextStep,
  previousStep,
  progressFraction,
  RATE_PRESETS_PCT_PER_WEEK,
  resetGoalForAge,
  stepCount,
  stepNumber,
  withGoal,
} from "@keylow/core/setup";
import { checkWeightKg } from "@keylow/core/weight";

import type { ActivityLevel, Sex } from "@keylow/core/engine";
import type {
  DietStyle,
  ProteinPreset,
  SetupDraft,
  SetupGoal,
  SetupStep,
} from "@keylow/core/setup";
import type { WeightDisplayUnit } from "@keylow/core/weight";

/**
 * The answers so far and the step the person is on. `hasLoadedSavedAnswers` is true once the saved answers
 * have joined the draft, which happens once. `hasEditedBirthDate` is true once the person has typed in the
 * birth date fields, so a saved birth date that arrives later does not come in under what they typed.
 * `hasEditedBody` is the same for the height, the weight and the units, and `weightFromWeighInOn` is the
 * date of the weigh-in the weight in the draft came from, until the weight changes. `unchosenDefaults`
 * lists the answers that arriving at a step filled in with its default and that the person has not
 * pressed, which a saved answer that arrives later may still replace.
 */
export type DefaultedAnswer = "proteinPreset" | "dietStyle";

export type SetupWizardState = Readonly<{
  draft: SetupDraft;
  step: SetupStep;
  hasLoadedSavedAnswers: boolean;
  hasEditedBirthDate: boolean;
  hasEditedBody: boolean;
  weightFromWeighInOn: string | undefined;
  unchosenDefaults: readonly DefaultedAnswer[];
}>;

/**
 * `today` is a `YYYY-MM-DD` in the device's time zone. A birth date is only ever handed over once it
 * passes `checkBirthDate`, and `undefined` says the fields no longer hold one. The same holds for the
 * height and the weight of `bodyChanged`, which are in centimetres and kilograms whatever the unit the
 * person types in, and the unit is the one the fields show. `weighInDate` is the `YYYY-MM-DD` of the
 * weigh-in the saved weight came from.
 */
export type SetupWizardAction =
  | Readonly<{ type: "sexChosen"; sex: Sex }>
  | Readonly<{ type: "birthDateChanged"; birthDate: string | undefined; today: string }>
  | Readonly<{
      type: "bodyChanged";
      heightCm: number | undefined;
      weightKg: number | undefined;
      weightUnit: WeightDisplayUnit;
    }>
  | Readonly<{
      type: "savedAnswersLoaded";
      saved: SetupDraft;
      today: string;
      weighInDate?: string | undefined;
    }>
  | Readonly<{ type: "activityChosen"; activity: ActivityLevel }>
  | Readonly<{ type: "goalChosen"; goal: SetupGoal }>
  | Readonly<{ type: "rateChosen"; ratePctPerWeek: number }>
  | Readonly<{ type: "proteinChosen"; proteinPreset: ProteinPreset }>
  | Readonly<{ type: "dietChosen"; dietStyle: DietStyle }>
  | Readonly<{ type: "continued"; today: string }>
  | Readonly<{ type: "wentBack" }>;

export const initialSetupWizardState: SetupWizardState = {
  draft: {},
  step: "sex",
  hasLoadedSavedAnswers: false,
  hasEditedBirthDate: false,
  hasEditedBody: false,
  weightFromWeighInOn: undefined,
  unchosenDefaults: [],
};

/**
 * Whether the person has answered this step so that Continue is live. The estimate is not a question, so it
 * is never complete. A saved height can be outside the bounds, so the body step checks both numbers again,
 * and a saved rate can be off the presets, so the rate step does too, though arriving at it has already
 * snapped it.
 */
export function isStepComplete(draft: SetupDraft, step: SetupStep, today: string): boolean {
  switch (step) {
    case "sex":
      return draft.sex !== undefined;
    case "birthDate":
      return draft.birthDate !== undefined && checkBirthDate(draft.birthDate, today).ok;
    case "body":
      return (
        draft.heightCm !== undefined &&
        checkHeightCm(draft.heightCm).ok &&
        draft.weightKg !== undefined &&
        checkWeightKg(draft.weightKg).ok
      );
    case "activity":
      return draft.activity !== undefined;
    case "goal":
      return draft.goal !== undefined;
    case "rate":
      return (
        draft.goal !== undefined &&
        draft.ratePctPerWeek !== undefined &&
        RATE_PRESETS_PCT_PER_WEEK[draft.goal].includes(draft.ratePctPerWeek)
      );
    case "protein":
      return draft.proteinPreset !== undefined;
    case "diet":
      return draft.dietStyle !== undefined;
    case "estimate":
      return false;
  }
}

/**
 * The goals offered to this person. Step 2 cannot be passed without a birth date, so it is there by the
 * goal step. Without one, Lose is not offered, which is the safe side.
 */
export function allowedGoalsOf(draft: SetupDraft, today: string): readonly SetupGoal[] {
  return goalsAllowed(draft.birthDate === undefined ? 0 : ageInYears(draft.birthDate, today));
}

/**
 * The state as the step being arrived at needs it. The rate, the protein preset and the diet style each
 * have a default that is chosen on arrival, so Continue is live and the answer is in the draft. A rate that
 * is not a preset of the goal, such as a saved one from a program written elsewhere, snaps to the nearest.
 * A rate is only asked for a goal that moves the weight. Nothing is chosen for the activity or the goal.
 * A default is not an answer the person gave, so the protein preset and the diet style it fills are noted
 * in `unchosenDefaults`.
 */
function withDefaultsFor(state: SetupWizardState, step: SetupStep): SetupWizardState {
  const { draft, unchosenDefaults } = state;
  switch (step) {
    case "rate":
      return isRateGoal(draft.goal)
        ? {
            ...state,
            draft: {
              ...draft,
              ratePctPerWeek: nearestRatePreset(
                draft.goal,
                draft.ratePctPerWeek ?? DEFAULT_RATE_PCT_PER_WEEK[draft.goal],
              ),
            },
          }
        : state;
    case "protein":
      return draft.proteinPreset === undefined
        ? {
            ...state,
            draft: { ...draft, proteinPreset: DEFAULT_PROTEIN_PRESET },
            unchosenDefaults: [...unchosenDefaults, "proteinPreset"],
          }
        : state;
    case "diet":
      return draft.dietStyle === undefined
        ? {
            ...state,
            draft: { ...draft, dietStyle: DEFAULT_DIET_STYLE },
            unchosenDefaults: [...unchosenDefaults, "dietStyle"],
          }
        : state;
    default:
      return state;
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

function withBody(
  draft: SetupDraft,
  { heightCm, weightKg, weightUnit }: Extract<SetupWizardAction, { type: "bodyChanged" }>,
): SetupDraft {
  const next = { ...draft, weightUnit, heightUnit: heightUnitFor(weightUnit) };
  if (heightCm === undefined) {
    delete next.heightCm;
  } else {
    next.heightCm = heightCm;
  }
  if (weightKg === undefined) {
    delete next.weightKg;
  } else {
    next.weightKg = weightKg;
  }
  return next;
}

/**
 * Once only, so a later read cannot undo what the person did since. What they answered while the saved
 * answers were loading wins, and so does a birth date they have typed even if it is not usable yet, and
 * so do the height, the weight and the units once the person has touched any of them. The
 * goal is then checked against the birth date that stands, so a saved Lose cannot outlive a birth date
 * that makes the person under 18.
 */
function withSavedAnswers(
  state: SetupWizardState,
  { saved, today, weighInDate }: Extract<SetupWizardAction, { type: "savedAnswersLoaded" }>,
): SetupWizardState {
  const savedToUse = { ...saved };
  if (state.hasEditedBirthDate) {
    delete savedToUse.birthDate;
  }
  if (state.hasEditedBody) {
    delete savedToUse.heightCm;
    delete savedToUse.weightKg;
    delete savedToUse.weightUnit;
    delete savedToUse.heightUnit;
  }
  // A default filled in on arrival is not an answer the person gave, so a saved answer replaces it.
  const replacesDefault: SetupDraft = {
    ...(state.unchosenDefaults.includes("proteinPreset") && savedToUse.proteinPreset !== undefined
      ? { proteinPreset: savedToUse.proteinPreset }
      : {}),
    ...(state.unchosenDefaults.includes("dietStyle") && savedToUse.dietStyle !== undefined
      ? { dietStyle: savedToUse.dietStyle }
      : {}),
  };
  const merged: SetupDraft = { ...savedToUse, ...state.draft, ...replacesDefault };
  const draft =
    merged.birthDate === undefined
      ? merged
      : resetGoalForAge(merged, ageInYears(merged.birthDate, today));
  return {
    ...state,
    draft,
    hasLoadedSavedAnswers: true,
    unchosenDefaults: [],
    weightFromWeighInOn: savedToUse.weightKg === undefined ? undefined : weighInDate,
  };
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
    case "bodyChanged":
      return {
        ...state,
        draft: withBody(state.draft, action),
        hasEditedBody: true,
        weightFromWeighInOn:
          action.weightKg === state.draft.weightKg ? state.weightFromWeighInOn : undefined,
      };
    case "savedAnswersLoaded":
      return state.hasLoadedSavedAnswers ? state : withSavedAnswers(state, action);
    case "activityChosen":
      return { ...state, draft: { ...state.draft, activity: action.activity } };
    case "goalChosen":
      return { ...state, draft: withGoal(state.draft, action.goal) };
    case "rateChosen":
      return { ...state, draft: { ...state.draft, ratePctPerWeek: action.ratePctPerWeek } };
    case "proteinChosen":
      return {
        ...state,
        draft: { ...state.draft, proteinPreset: action.proteinPreset },
        unchosenDefaults: state.unchosenDefaults.filter((answer) => answer !== "proteinPreset"),
      };
    case "dietChosen":
      return {
        ...state,
        draft: { ...state.draft, dietStyle: action.dietStyle },
        unchosenDefaults: state.unchosenDefaults.filter((answer) => answer !== "dietStyle"),
      };
    case "continued": {
      const step = nextStep(state.draft, state.step);
      return step === undefined || !isStepComplete(state.draft, state.step, action.today)
        ? state
        : { ...withDefaultsFor(state, step), step };
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
