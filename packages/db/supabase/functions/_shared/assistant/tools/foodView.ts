// What the model is told about a food. The repos read every food column and `food_portions.*`, so the
// projection here is what limits the fields: it is the one place that lists which of them leave the
// tool, and a column added to `foods` later reaches the model only by being added here.
type PortionFields = { id: string; label: string; grams: number | null; ml: number | null };

type FoodFields = {
  id: string;
  name: string;
  brand: string | null;
  source: string;
  basis: string;
  kcal: number | null;
  protein_g: number | null;
  fat_g: number | null;
  carbs_g: number | null;
  fibre_g: number | null;
};

// A portion is a weight or a volume, never both, so a liquid's portion has `ml` and no `grams`.
// The id is what a write tool takes to log the portion, so the model never has to guess it.
const portionView = ({ id, label, grams, ml }: PortionFields) => ({ id, label, grams, ml });

// Null portions say they were not looked up, which an empty list would not: an empty list says the
// food has none.
export const foodView = (food: FoodFields, portions: readonly PortionFields[] | null) => ({
  id: food.id,
  name: food.name,
  brand: food.brand,
  source: food.source,
  basis: food.basis,
  kcal: food.kcal,
  protein_g: food.protein_g,
  fat_g: food.fat_g,
  carbs_g: food.carbs_g,
  fibre_g: food.fibre_g,
  portions: portions === null ? null : portions.map(portionView),
});
