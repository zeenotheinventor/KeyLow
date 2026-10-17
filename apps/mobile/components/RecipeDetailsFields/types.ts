import type { RecipeDraft } from "@keylow/core/recipes";
import type { Ref } from "react";
import type { TextInput } from "react-native";

export type RecipeDetailsField = "name" | "servings" | "cookedWeight";

export type RecipeDetailsFieldsProps = {
  draft: RecipeDraft;
  /** The sentence under each field that is wrong. A field with none is fine. */
  errors: Partial<Record<RecipeDetailsField, string | undefined>>;
  /** Saving is under way: the fields keep their values and take no typing. */
  isLocked: boolean;
  onChange: (field: RecipeDetailsField, text: string) => void;
  nameRef: Ref<TextInput>;
  servingsRef: Ref<TextInput>;
  cookedWeightRef: Ref<TextInput>;
};
