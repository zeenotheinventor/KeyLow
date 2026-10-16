import {
  enteredNumber,
  isNumberBeingTyped,
  macroKcal,
  macrosDisagreeWithCalories,
  validateQuickAdd,
} from "@keylow/core/diary";
import { useState } from "react";

import type { QuickAddDraft, QuickAddField, QuickAddTexts } from "./types";

const NO_TEXTS: QuickAddTexts = { kcal: "", protein: "", carbs: "", fat: "", label: "" };

// What the field holds as a number for core. A lone point or comma is a number not yet typed, so it is blank.
// Any other text that is not a number, such as "1,200", stays NaN so that core refuses it.
function enteredGrams(text: string): number | null {
  return text === "." || text === "," ? null : enteredNumber(text);
}

/**
 * The state of the quick add fields: the five texts, checked by core's `validateQuickAdd`, and the line
 * under Calories (what the macros add up to, and whether that is more than a quarter off the calories).
 * The add dialog starts them blank and the edit dialog starts them from the entry.
 */
export function useQuickAddDraft(initialTexts: QuickAddTexts = NO_TEXTS): QuickAddDraft {
  const [texts, setTexts] = useState(initialTexts);
  const [hasTouchedKcal, setHasTouchedKcal] = useState(false);

  const kcal = enteredGrams(texts.kcal);
  const protein = enteredGrams(texts.protein);
  const carbs = enteredGrams(texts.carbs);
  const fat = enteredGrams(texts.fat);
  const validated = validateQuickAdd({
    kcal,
    protein_g: protein,
    fat_g: fat,
    carbs_g: carbs,
    label: texts.label,
  });

  return {
    texts,
    validated,
    hasKcalError: hasTouchedKcal && !validated.ok && validated.problems.kcal !== undefined,
    hasMacros: protein !== null || carbs !== null || fat !== null,
    macrosDisagree: macrosDisagreeWithCalories(kcal, protein, fat, carbs),
    macroTotal: macroKcal(protein, fat, carbs),
    change: (field: QuickAddField, text: string) => {
      if (field === "label" || isNumberBeingTyped(text)) {
        setTexts((current) => ({ ...current, [field]: text }));
      }
      if (field === "kcal") {
        setHasTouchedKcal(true);
      }
    },
    touchKcal: () => {
      setHasTouchedKcal(true);
    },
  };
}
