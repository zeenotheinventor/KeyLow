import type { RecipeEntryUnit, TypedRecipeAmount } from "@keylow/core/diary";
import type { RecipeOfSnapshot } from "@keylow/core/recipes";
import type { ReactNode, Ref } from "react";

/** What the fields draw and edit of a recipe amount: the text and unit chosen, and what they come to. */
export type RecipeAmountDraft = {
  /** The amount in the field. */
  quantityText: string;
  /** Servings, or grams of cooked weight. */
  unit: RecipeEntryUnit;
  /** What the amount comes to, or null while it is not a number above 0 or is too large to work out. */
  typed: TypedRecipeAmount | null;
  setQuantityText: (text: string) => void;
  setUnit: (unit: RecipeEntryUnit) => void;
};

export type RecipeAmountFieldsProps = {
  /**
   * The recipe the figures are drawn from: the library's row when adding, and what the entry froze
   * (core's `recipeOfSnapshot`) when editing, so a logged recipe never reads the live one.
   */
  recipe: RecipeOfSnapshot;
  draft: RecipeAmountDraft;
  /** The Time field's value, `HH:mm`. */
  time: string;
  /** The time is still the moment the dialog opened, so the Time field says Now. */
  isNow: boolean;
  onTimeChange: (time: string) => void;
  /** Reaches the amount field, so the cursor can start in it. */
  amountRef?: Ref<HTMLInputElement> | undefined;
  /** Above the Recipe badge: a failed save. */
  notice?: ReactNode;
  /** Under the Recipe badge and what the recipe makes: what is known about the recipe itself. */
  recipeNotice?: ReactNode;
};
