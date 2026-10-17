import type { RecentFood } from "@keylow/api-client";
import type { LogContext } from "@keylow/core/diary";

/** `own` is the sheet titled "Your foods", which lists and filters only the user's own foods. */
export type FoodSearchScope = "all" | "own";

/** What the sheet needs while food is being logged to a day, which is when it is opened with a `day`. */
export type FoodSearchLogging = {
  context: LogContext;
  /** Opens the portion picker for a Recent food, filled in with the amount it was last logged with. */
  onOpenRecent: (foodId: string) => void;
  /** Opens the amount step for a recipe, from its row in "Your recipes", with the day and time carried on. */
  onOpenRecipe: (recipeId: string) => void;
  /** Opens the quick add form, from the Quick add row, with the day and time carried on. */
  onQuickAdd: () => void;
};

/** What the sheet needs while it finds an ingredient for a recipe, which is when it is opened with an `ingredient`. */
export type FoodSearchIngredient = {
  /** Opens the amount step for a Recent food, filled in with the amount it was last logged with. */
  onOpenRecent: (recent: RecentFood) => void;
};

type FoodSearchSharedProps = {
  onClose: () => void;
  onOpenFood: (foodId: string) => void;
};

/** The sheet that finds food to look at or to log, which can also create a food and scan a barcode. */
type FoodSearchFoodsProps = FoodSearchSharedProps & {
  /** Defaults to `all`. */
  scope?: FoodSearchScope;
  onCreateFood: () => void;
  onScanBarcode: () => void;
  /** Puts the sheet in log mode: titled "Log food", with servings and a plus on each row. Leave it out for the plain search. */
  logging?: FoodSearchLogging | undefined;
  ingredient?: undefined;
};

/**
 * The sheet that finds an ingredient for a recipe: titled "Add ingredient", every result a row that opens
 * the amount step (no plus, no Quick add, no recipes). It cannot create a food or scan a barcode, because
 * both leave the recipe, whose draft is unsaved, for a form or a camera.
 */
type FoodSearchIngredientProps = FoodSearchSharedProps & {
  ingredient: FoodSearchIngredient;
  scope?: undefined;
  onCreateFood?: undefined;
  onScanBarcode?: undefined;
  logging?: undefined;
};

export type FoodSearchProps = FoodSearchFoodsProps | FoodSearchIngredientProps;
