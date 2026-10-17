/** `food` heads the diary's table. `recipe` heads the recipe library's, which has a Servings column. */
export type FoodTableVariant = "food" | "recipe";

export type FoodTableHeaderProps = {
  variant?: FoodTableVariant | undefined;
};
