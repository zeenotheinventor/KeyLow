import { FOOD_MACRO_LABELS, FOOD_ROW, PORTION_PICKER, RECIPES_TABLE } from "@keylow/core/copy";

import {
  foodTableColumnsClassName,
  ingredientTableColumnsClassName,
  recipeTableColumnsClassName,
} from "./columns";

import type { FoodTableHeaderProps } from "./types";

import { cn } from "@/lib/utils";

// Each macro's colour is the same mark the food rows use, never a coloured word.
const macroColumns = [
  { label: FOOD_MACRO_LABELS.protein, dotClassName: "bg-protein" },
  { label: FOOD_MACRO_LABELS.carbs, dotClassName: "bg-carbs" },
  { label: FOOD_MACRO_LABELS.fat, dotClassName: "bg-fat" },
] as const;

/**
 * The column headings of an hour's foods at the wide width: Food, a coloured dot with each macro, and
 * kcal, and a heading for the actions that is only read out. `FoodTable` puts it above the rows; use
 * this directly only to compose a table of your own, as the first row inside its `role="table"`. It is
 * hidden at the narrow width, where the stacked rows take over. The `recipe` variant heads the recipe
 * library's table: Recipe and Servings in place of Food. The `ingredient` variant heads a recipe's
 * ingredients: Food, then Amount.
 */
export function FoodTableHeader({ variant = "food" }: FoodTableHeaderProps) {
  const isRecipe = variant === "recipe";
  const isIngredient = variant === "ingredient";

  return (
    <div
      role="row"
      className={cn(
        isRecipe
          ? recipeTableColumnsClassName
          : isIngredient
            ? ingredientTableColumnsClassName
            : foodTableColumnsClassName,
        "pb-1 pt-2 text-caption text-text-muted max-md:hidden",
      )}
    >
      <span role="columnheader">{isRecipe ? RECIPES_TABLE.recipe : FOOD_ROW.foodColumn}</span>
      {isRecipe && (
        <span role="columnheader" className="text-right">
          {RECIPES_TABLE.servings}
        </span>
      )}
      {isIngredient && <span role="columnheader">{PORTION_PICKER.amountLabel}</span>}
      {macroColumns.map(({ label, dotClassName }) => (
        <span key={label} role="columnheader" className="flex items-center justify-end gap-[6px]">
          <span aria-hidden className={cn("size-[6px] shrink-0 rounded-[2px]", dotClassName)} />
          {label}
        </span>
      ))}
      <span role="columnheader" className="text-right">
        {FOOD_ROW.energyUnit}
      </span>
      {/* The column of the Edit and Delete buttons has no drawn heading, but assistive technology needs one. */}
      <span role="columnheader" className="sr-only">
        {FOOD_ROW.actionsColumn}
      </span>
    </div>
  );
}
