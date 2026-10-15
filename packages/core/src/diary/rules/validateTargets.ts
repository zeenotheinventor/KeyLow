import { findMacroProblems, isUsableNumber } from "./validation";

import type { EnteredNumber, MacroProblems, ValidationResult } from "./validation";

export const TARGET_KCAL_MINIMUM = 800;
export const TARGET_KCAL_MAXIMUM = 6000;

export type TargetsInput = {
  kcal: EnteredNumber;
  protein_g: EnteredNumber;
  fat_g: EnteredNumber;
  carbs_g: EnteredNumber;
};

export type ValidTargets = {
  kcal: number;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
};

export type TargetsProblems = MacroProblems & { kcal?: "required" | "out_of_range" };

/** Calories are required and within 800 to 6,000. The macros are optional and 0 or more. */
export const validateTargets = (
  input: TargetsInput,
): ValidationResult<ValidTargets, TargetsProblems> => {
  const problems: TargetsProblems = findMacroProblems(input);
  const { kcal } = input;

  if (!isUsableNumber(kcal)) {
    problems.kcal = "required";
  } else if (kcal < TARGET_KCAL_MINIMUM || kcal > TARGET_KCAL_MAXIMUM) {
    problems.kcal = "out_of_range";
  }

  if (Object.keys(problems).length > 0 || !isUsableNumber(kcal)) {
    return { ok: false, problems };
  }
  return {
    ok: true,
    value: { kcal, protein_g: input.protein_g, fat_g: input.fat_g, carbs_g: input.carbs_g },
  };
};
