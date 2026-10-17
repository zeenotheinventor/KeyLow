/**
 * `food` heads the diary's table. `recipe` heads the recipe library's, which has a Servings column.
 * `ingredient` heads a recipe's ingredients, which have an Amount column.
 */
export type FoodTableVariant = "food" | "recipe" | "ingredient";

export type FoodTableHeaderProps = {
  variant?: FoodTableVariant | undefined;
};
