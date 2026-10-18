import { TRAINING_PARAMS_VERSION } from "./params";
import { parseGoalAnswers } from "./parseGoalAnswers";

import type { TrainingGoal } from "./enums";
import type { GoalAnswers } from "./goalAnswers";

/*
 * The nutrition bridge of the goal presets v1 that Zee agreed on 2026-10-18 (Linear document "Goal presets
 * and golden suggestions", on KEY-396, Part 6). The names are neutral because the program vocabulary of M6
 * does not exist yet, so M6 maps a direction and a rate to its own goal type later.
 *
 * Under the purity and versioning rule of ADR 0002, a change to any value below is a new version, never an
 * edit of `keylow-training-v1` in place.
 */

export const NUTRITION_DIRECTIONS = ["lean_gain", "maintain", "slight_surplus"] as const;

export type NutritionDirection = (typeof NUTRITION_DIRECTIONS)[number];

/** What the program could be set to for a goal. It is a proposal, and nothing changes until the user confirms. */
export type NutritionProposal = Readonly<{
  direction: NutritionDirection;
  /** A percentage of body weight a week, positive for a gain. */
  weeklyRatePercent: number;
  /** Grams of protein a day for each kilogram of body weight. ADR 0005 bounds it from 1.6 to 2.2. */
  proteinGramsPerKilogram: number;
}>;

export type NutritionProposals = Readonly<{
  version: typeof TRAINING_PARAMS_VERSION;
  /** For a focus list without V-taper, whatever else it names. */
  withoutVTaper: Readonly<Record<TrainingGoal, NutritionProposal>>;
  /** For a focus list with V-taper, whatever else it names and whatever the goal. */
  withVTaper: Readonly<Record<TrainingGoal, NutritionProposal>>;
}>;

export const NUTRITION_PROPOSALS_V1: NutritionProposals = {
  version: TRAINING_PARAMS_VERSION,
  withoutVTaper: {
    aesthetic: { direction: "lean_gain", weeklyRatePercent: 0.25, proteinGramsPerKilogram: 2.0 },
    strength: { direction: "slight_surplus", weeklyRatePercent: 0.1, proteinGramsPerKilogram: 1.8 },
    hybrid: { direction: "lean_gain", weeklyRatePercent: 0.15, proteinGramsPerKilogram: 2.0 },
  },
  withVTaper: {
    aesthetic: { direction: "maintain", weeklyRatePercent: 0, proteinGramsPerKilogram: 2.0 },
    strength: { direction: "maintain", weeklyRatePercent: 0, proteinGramsPerKilogram: 2.0 },
    hybrid: { direction: "maintain", weeklyRatePercent: 0, proteinGramsPerKilogram: 2.0 },
  },
};

/**
 * The nutrition the goal suggests. Only V-taper changes it, and it wins over any goal and any other focus,
 * so the order the focuses were chosen in does not matter. Pure: it reads and writes no program, target or
 * profile, and nothing it returns is applied without the user's confirmation.
 *
 * Throws a `RangeError` stating the rule when the answers fail the questionnaire rules.
 */
export const proposeNutrition = (
  answers: GoalAnswers,
  proposals: NutritionProposals = NUTRITION_PROPOSALS_V1,
): NutritionProposal => {
  const { goal, focus } = parseGoalAnswers(answers);
  return (focus.includes("v_taper") ? proposals.withVTaper : proposals.withoutVTaper)[goal];
};
