import type { RecipeSummary } from "@keylow/api-client";

/** The recipes to choose from: still loading, failed with its way to try again, or the live recipes. */
export type RecipePickerState =
  | { status: "loading" }
  | { status: "error"; onRetry: () => void }
  | { status: "ready"; recipes: readonly RecipeSummary[] };

export type RecipePickerDialogProps = {
  open: boolean;
  state: RecipePickerState;
  /** Called for Escape, the Close button and a press outside. */
  onClose: () => void;
  /** Called with the recipe pressed. The screen closes the picker and opens the add dialog for it. */
  onChoose: (recipe: RecipeSummary) => void;
};
