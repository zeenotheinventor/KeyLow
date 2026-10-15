import type { validateQuickAdd } from "@keylow/core/diary";
import type { Ref } from "react";

/** What the five fields hold, as the person typed it. */
export type QuickAddTexts = {
  kcal: string;
  protein: string;
  carbs: string;
  fat: string;
  label: string;
};

export type QuickAddField = keyof QuickAddTexts;

/** The quick add fields' state, shared by the add dialog and the edit dialog so the two cannot drift. */
export type QuickAddDraft = {
  texts: QuickAddTexts;
  /** The fields checked by core: the values to save, or what is wrong. */
  validated: ReturnType<typeof validateQuickAdd>;
  /** The calories field is to say what is wrong, which it does once the person has touched it. */
  hasKcalError: boolean;
  /** At least one macro has been given. */
  hasMacros: boolean;
  /** The macros add up to more than a quarter away from the calories. Information only. */
  macrosDisagree: boolean;
  /** What the macros add up to, in kcal. */
  macroTotal: number;
  /** Sets a field to what was typed. A number field takes digits and one point or comma only. */
  change: (field: QuickAddField, text: string) => void;
  /** The calories field has been left, so a blank one is said to be wrong. */
  touchKcal: () => void;
};

export type QuickAddFieldsProps = {
  draft: QuickAddDraft;
  /** Reaches the Calories field, so a dialog can put the cursor in it. */
  caloriesRef?: Ref<HTMLInputElement> | undefined;
};
