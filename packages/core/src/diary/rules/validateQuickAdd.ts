import { findMacroProblems, isUsableNumber } from "./validation";

import type { EnteredNumber, MacroProblems, ValidationResult } from "./validation";

export type QuickAddInput = {
  kcal: EnteredNumber;
  protein_g: EnteredNumber;
  fat_g: EnteredNumber;
  carbs_g: EnteredNumber;
  label: string | null;
};

export type ValidQuickAdd = {
  kcal: number;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  /** Trimmed, and null when it was left blank. */
  label: string | null;
};

export type QuickAddProblems = MacroProblems & { kcal?: "required" | "not_above_zero" };

/** Calories are required and above 0. The macros are optional and 0 or more. */
export const validateQuickAdd = (
  input: QuickAddInput,
): ValidationResult<ValidQuickAdd, QuickAddProblems> => {
  const problems: QuickAddProblems = findMacroProblems(input);
  const { kcal } = input;

  if (!isUsableNumber(kcal)) {
    problems.kcal = "required";
  } else if (kcal <= 0) {
    problems.kcal = "not_above_zero";
  }

  if (Object.keys(problems).length > 0 || !isUsableNumber(kcal)) {
    return { ok: false, problems };
  }
  const label = input.label?.trim() ?? "";
  return {
    ok: true,
    value: {
      kcal,
      protein_g: input.protein_g,
      fat_g: input.fat_g,
      carbs_g: input.carbs_g,
      label: label === "" ? null : label,
    },
  };
};
