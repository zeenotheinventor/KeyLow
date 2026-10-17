import type { RecipeDraft } from "@keylow/core/recipes";
import type { Ref } from "react";

/** The fields of the Details card that the editor owns and a problem can point at. */
export type RecipeDetailsField = "name" | "servings" | "cookedWeight";

export type RecipeDetailsCardProps = {
  draft: Pick<RecipeDraft, "name" | "servings" | "cookedWeight" | "ingredients">;
  /** The sentence for each field that has a problem, in core's words. */
  errors: { [Field in RecipeDetailsField]?: string | undefined };
  /** The fields cannot be changed, as while a save is on its way. */
  isLocked: boolean;
  onChange: (field: RecipeDetailsField, text: string) => void;
  /** Where each field's input goes, so the screen can move focus to the first one with a problem. */
  nameRef: Ref<HTMLInputElement>;
  servingsRef: Ref<HTMLInputElement>;
  cookedWeightRef: Ref<HTMLInputElement>;
};
