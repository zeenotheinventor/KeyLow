import {
  defaultGoalForAge,
  DEFAULT_DIET_STYLE,
  DEFAULT_PROTEIN_PRESET,
  DEFAULT_RATE_PCT_PER_WEEK,
  DIET_FAT_FRACTION_OF_REMAINDER,
  DIET_STYLES,
  goalsAllowed,
  nearestRatePreset,
  PROTEIN_G_PER_KG,
  PROTEIN_PRESETS,
  withGoal,
} from "@keylow/core/setup";

import type { ProgramChanges, SetupProgram } from "@keylow/api-client";
import type { DietStyle, ProteinPreset, SetupGoal } from "@keylow/core/setup";

/** The four choices of the form. Each one is always chosen, so a save never lacks one. */
export type ProgramEditDraft = Readonly<{
  goal: SetupGoal;
  ratePctPerWeek: number;
  proteinPreset: ProteinPreset;
  dietStyle: DietStyle;
}>;

/**
 * What the form starts from: the stored programme. A stored rate that is not one of the goal's presets snaps to
 * the nearest, and a stored goal that the age does not allow (Lose under 18, or with no birth date, where the age
 * is 0) starts from the goal the age defaults to, with that goal's default rate. A stored protein or diet that is
 * not a preset starts from the default.
 */
export function initialDraftOf(program: SetupProgram, ageYears: number): ProgramEditDraft {
  const isGoalAllowed = goalsAllowed(ageYears).includes(program.goal);
  const goal = isGoalAllowed ? program.goal : defaultGoalForAge(ageYears);

  return {
    goal,
    ratePctPerWeek: isGoalAllowed
      ? nearestRatePreset(goal, program.ratePctPerWeek)
      : DEFAULT_RATE_PCT_PER_WEEK[goal],
    proteinPreset:
      PROTEIN_PRESETS.find((preset) => PROTEIN_G_PER_KG[preset] === program.proteinGPerKg) ??
      DEFAULT_PROTEIN_PRESET,
    dietStyle: DIET_STYLES.find((style) => style === program.splitPreset) ?? DEFAULT_DIET_STYLE,
  };
}

/** The draft with this goal chosen, which brings that goal's default rate back unless it was already the goal. */
export function chooseGoal(draft: ProgramEditDraft, goal: SetupGoal): ProgramEditDraft {
  const { ratePctPerWeek = draft.ratePctPerWeek } = withGoal(draft, goal);
  return { ...draft, goal, ratePctPerWeek };
}

/** The draft as the program columns the edit writes, in the values the wizard's presets hold. */
export function changesOf({
  goal,
  ratePctPerWeek,
  proteinPreset,
  dietStyle,
}: ProgramEditDraft): ProgramChanges {
  return {
    goal,
    ratePctPerWeek,
    proteinGPerKg: PROTEIN_G_PER_KG[proteinPreset],
    fatFraction: DIET_FAT_FRACTION_OF_REMAINDER[dietStyle],
    splitPreset: dietStyle,
  };
}
