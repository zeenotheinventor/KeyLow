import type { RecentFood } from "@keylow/api-client";
import type { RecipeIngredient } from "@keylow/core/recipes";

/** The food the person chose in the search, and the Recent row it was chosen from if it was. */
export type ChosenFood = {
  foodId: string;
  recent?: RecentFood | undefined;
};

export type AddIngredientSheetProps = {
  /** The food whose amount step is open, if one is. Otherwise the search is. The caller owns it so the back button can step back. */
  chosen: ChosenFood | undefined;
  onChoose: (chosen: ChosenFood) => void;
  /** Back from the amount step, to the results with the search as it was. */
  onBackToResults: () => void;
  /** Close, from the search: back to the editor with nothing changed. */
  onClose: () => void;
  /** Scan barcode, from the search. The editor opens the scanner over itself, and a food the scanner finds comes back as the chosen one. */
  onScanBarcode: () => void;
  /** Add to recipe: the ingredient that joins the draft. */
  onAdd: (ingredient: RecipeIngredient) => void;
};
